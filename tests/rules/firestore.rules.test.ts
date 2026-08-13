import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Security rules are the only authorization layer in this app — there is no
 * backend to fall back on. These run against the Firestore emulator:
 *
 *   npm run emulators      (in one terminal)
 *   npm run test:rules
 */

const ALICE = "alice-uid";
const BOB = "bob-uid";

let testEnv: RulesTestEnvironment;

const EXPIRE_AT = Timestamp.fromDate(new Date(2026, 8, 1));

function shiftDoc(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerId,
    ownerName: "טל כהן",
    ownerPhone: "972501234567",
    ownerEmail: "tal@example.com",
    date: "2026-08-25",
    monthKey: "2026-08",
    department: "pnimit",
    internalUnit: "gimel",
    note: null,
    urgent: false,
    willingToSwap: false,
    status: "open",
    createdAt: serverTimestamp(),
    expireAt: EXPIRE_AT,
    ...overrides,
  };
}

function db(uid: string | null): Firestore {
  const context =
    uid === null
      ? testEnv.unauthenticatedContext()
      : testEnv.authenticatedContext(uid);
  return context.firestore() as unknown as Firestore;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "swapp-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed one open shift owned by Alice, bypassing rules.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const raw = context.firestore() as unknown as Firestore;
    await setDoc(doc(raw, "shifts", "shift-1"), shiftDoc(ALICE));
  });
});

describe("authentication", () => {
  it("keeps the board closed to anonymous visitors", async () => {
    await assertFails(getDoc(doc(db(null), "shifts", "shift-1")));
  });

  it("opens the board to any signed-in intern", async () => {
    await assertSucceeds(getDoc(doc(db(BOB), "shifts", "shift-1")));
  });
});

describe("shift ownership", () => {
  it("lets an intern post a shift under their own id", async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), "shifts", "new-1"), shiftDoc(BOB)),
    );
  });

  it("refuses a shift posted under someone else's id", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "shifts", "forged"), shiftDoc(ALICE)),
    );
  });

  it("refuses a shift that arrives already claimed", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "shifts", "sneaky"),
        shiftDoc(BOB, { status: "handedOff" }),
      ),
    );
  });

  it("refuses a shift whose monthKey disagrees with its date", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "shifts", "mismatched"),
        shiftDoc(BOB, { date: "2026-08-25", monthKey: "2026-09" }),
      ),
    );
  });

  it("refuses an unknown department", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "shifts", "unknown-dept"),
        shiftDoc(BOB, { department: "cardiology" }),
      ),
    );
  });

  it("lets the owner mark their shift handed off", async () => {
    await assertSucceeds(
      updateDoc(doc(db(ALICE), "shifts", "shift-1"), {
        status: "handedOff",
      }),
    );
  });

  it("stops a stranger editing someone else's shift", async () => {
    await assertFails(
      updateDoc(doc(db(BOB), "shifts", "shift-1"), { status: "handedOff" }),
    );
  });

  it("stops a stranger deleting someone else's shift", async () => {
    await assertFails(deleteDoc(doc(db(BOB), "shifts", "shift-1")));
  });

  it("lets the owner delete their own shift", async () => {
    await assertSucceeds(deleteDoc(doc(db(ALICE), "shifts", "shift-1")));
  });
});

describe("quotas", () => {
  const quotaId = `${BOB}__2026-08`;

  function quotaDoc(overrides: Record<string, unknown> = {}) {
    return {
      uid: BOB,
      monthKey: "2026-08",
      dates: { "2026-08-25": true },
      expireAt: EXPIRE_AT,
      ...overrides,
    };
  }

  /**
   * Batched writes must all come from one Firestore instance, and `db()`
   * hands back a fresh one per call — so these tests hold a single handle.
   */
  function postShift(
    bob: Firestore,
    shiftId: string,
    date: string,
    overrides: { urgent?: boolean } = {},
  ) {
    const batch = writeBatch(bob);
    batch.set(
      doc(bob, "shifts", shiftId),
      shiftDoc(BOB, { date, monthKey: date.slice(0, 7), urgent: overrides.urgent ?? false }),
    );
    batch.set(
      doc(bob, "quotas", `${BOB}__${date.slice(0, 7)}`),
      {
        uid: BOB,
        monthKey: date.slice(0, 7),
        expireAt: EXPIRE_AT,
        dates: { [date]: true },
        ...(overrides.urgent ? { urgentShiftId: shiftId } : {}),
      },
      { merge: true },
    );
    return batch.commit();
  }

  it("allows the first, non-urgent shift of the month to create the quota", async () => {
    await assertSucceeds(postShift(db(BOB), "shift-a", "2026-08-25"));
  });

  it("allows a second shift on a different date", async () => {
    const bob = db(BOB);
    await postShift(bob, "shift-a", "2026-08-25");
    await assertSucceeds(postShift(bob, "shift-b", "2026-08-26"));
  });

  it("rejects a second shift dated the same day, at the server", async () => {
    const bob = db(BOB);
    await postShift(bob, "shift-a", "2026-08-25");

    // The date key already exists, so dates is unchanged either direction —
    // neither the claim nor the release branch is satisfied.
    await assertFails(postShift(bob, "shift-b", "2026-08-25"));
  });

  it("does not create the second shift either, since the batch is atomic", async () => {
    const bob = db(BOB);
    await postShift(bob, "shift-a", "2026-08-25");
    await assertFails(postShift(bob, "shift-b", "2026-08-25"));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      const rejected = await getDoc(doc(raw, "shifts", "shift-b"));
      expect(rejected.exists()).toBe(false);
    });
  });

  it("allows a fourth shift and rejects a fifth, at the server", async () => {
    const bob = db(BOB);
    // Distinct from the "shift-1" seeded in beforeEach (owned by Alice), or
    // Bob's write would be evaluated as an update on her doc, not a create.
    await postShift(bob, "bob-shift-1", "2026-08-01");
    await postShift(bob, "bob-shift-2", "2026-08-02");
    await postShift(bob, "bob-shift-3", "2026-08-03");
    await assertSucceeds(postShift(bob, "bob-shift-4", "2026-08-04"));
    await assertFails(postShift(bob, "bob-shift-5", "2026-08-05"));
  });

  it("allows the first urgent shift of the month", async () => {
    await assertSucceeds(postShift(db(BOB), "urgent-1", "2026-08-25", { urgent: true }));
  });

  it("rejects a second urgent shift, at the server", async () => {
    const bob = db(BOB);
    await postShift(bob, "urgent-1", "2026-08-25", { urgent: true });

    // urgentShiftId already holds a value, so moving it to a different
    // value satisfies neither branch.
    await assertFails(postShift(bob, "urgent-2", "2026-08-26", { urgent: true }));
  });

  it("still allows a shift in a different month, independent of this one", async () => {
    const bob = db(BOB);
    await postShift(bob, "shift-a", "2026-08-25", { urgent: true });
    await assertSucceeds(postShift(bob, "shift-b", "2026-09-05", { urgent: true }));
  });

  it("refuses a quota doc whose id does not match its owner", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "quotas", `${ALICE}__2026-08`), quotaDoc()),
    );
  });

  it("refuses a quota doc claiming to belong to someone else", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "quotas", quotaId), quotaDoc({ uid: ALICE })),
    );
  });

  it("releases a date when the intern deletes that shift", async () => {
    await setDoc(doc(db(BOB), "quotas", quotaId), quotaDoc());
    await assertSucceeds(
      updateDoc(doc(db(BOB), "quotas", quotaId), {
        "dates.2026-08-25": deleteField(),
      }),
    );
  });

  it("releases urgentShiftId when the intern deletes their urgent shift", async () => {
    await setDoc(
      doc(db(BOB), "quotas", quotaId),
      quotaDoc({ urgentShiftId: "urgent-1" }),
    );
    await assertSucceeds(
      updateDoc(doc(db(BOB), "quotas", quotaId), {
        "dates.2026-08-25": deleteField(),
        urgentShiftId: null,
      }),
    );
  });

  it("stops one intern releasing another's quota", async () => {
    await setDoc(doc(db(BOB), "quotas", quotaId), quotaDoc());
    await assertFails(
      updateDoc(doc(db(ALICE), "quotas", quotaId), {
        "dates.2026-08-25": deleteField(),
      }),
    );
  });

  it("never deletes the quota document itself", async () => {
    await setDoc(doc(db(BOB), "quotas", quotaId), quotaDoc());
    await assertFails(deleteDoc(doc(db(BOB), "quotas", quotaId)));
  });

  it("lets an intern read their own nonexistent quota doc without a permission error", async () => {
    await assertSucceeds(getDoc(doc(db(BOB), "quotas", quotaId)));
  });

  it("keeps quotas private to their owner", async () => {
    await setDoc(doc(db(BOB), "quotas", quotaId), quotaDoc());
    await assertSucceeds(getDoc(doc(db(BOB), "quotas", quotaId)));
    await assertFails(getDoc(doc(db(ALICE), "quotas", quotaId)));
  });
});

describe("profiles", () => {
  it("lets an intern write their own profile", async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), "users", BOB), {
        displayName: "נועה לוי",
        phone: "972521234567",
        email: "noa@example.com",
      }),
    );
  });

  it("stops an intern writing someone else's", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "users", ALICE), {
        displayName: "טל כהן",
        phone: "972501234567",
        email: "tal@example.com",
      }),
    );
  });

  it("keeps profiles private to their owner", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      await setDoc(doc(raw, "users", ALICE), {
        displayName: "טל כהן",
        phone: "972501234567",
        email: "tal@example.com",
      });
    });
    await assertSucceeds(getDoc(doc(db(ALICE), "users", ALICE)));
    await assertFails(getDoc(doc(db(BOB), "users", ALICE)));
  });
});

describe("collections that do not exist", () => {
  it("denies writes to anything unmatched", async () => {
    await assertFails(setDoc(doc(db(BOB), "arbitrary", "x"), { a: 1 }));
  });
});

/** Guards against the seed drifting out of sync with the rules. */
it("seeds a shift the rules consider valid", () => {
  expect(shiftDoc(ALICE).monthKey).toBe(shiftDoc(ALICE).date.slice(0, 7));
});
