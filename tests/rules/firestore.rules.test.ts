import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
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
const CAROL = "carol-uid";

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
    takenBy: null,
    interestCount: 0,
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
        takenBy: { uid: BOB, name: "נועה", phone: "972521234567" },
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

describe("the interest counter", () => {
  it("lets a non-owner increment it by exactly one", async () => {
    await assertSucceeds(
      updateDoc(doc(db(BOB), "shifts", "shift-1"), { interestCount: 1 }),
    );
  });

  it("refuses an arbitrary jump", async () => {
    await assertFails(
      updateDoc(doc(db(BOB), "shifts", "shift-1"), { interestCount: 50 }),
    );
  });

  it("refuses a decrement", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      await updateDoc(doc(raw, "shifts", "shift-1"), { interestCount: 5 });
    });
    await assertFails(
      updateDoc(doc(db(BOB), "shifts", "shift-1"), { interestCount: 4 }),
    );
  });

  it("refuses another field smuggled alongside the increment", async () => {
    await assertFails(
      updateDoc(doc(db(BOB), "shifts", "shift-1"), {
        interestCount: 1,
        ownerPhone: "972500000000",
      }),
    );
  });

  it("stops the owner inflating their own shift's count", async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), "shifts", "shift-1"), { interestCount: 9 }),
    );
  });
});

describe("interests", () => {
  const interestId = `shift-1__${BOB}`;

  function interestDoc(overrides: Record<string, unknown> = {}) {
    return {
      shiftId: "shift-1",
      shiftOwnerId: ALICE,
      takerId: BOB,
      takerName: "נועה לוי",
      takerPhone: "972521234567",
      status: "pending",
      createdAt: serverTimestamp(),
      expireAt: EXPIRE_AT,
      ...overrides,
    };
  }

  it("lets an intern register interest in someone else's shift", async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), "interests", interestId), interestDoc()),
    );
  });

  it("refuses an id that does not match the shift and taker", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "interests", "made-up-id"), interestDoc()),
    );
  });

  it("refuses registering interest on your own shift", async () => {
    await assertFails(
      setDoc(
        doc(db(ALICE), "interests", `shift-1__${ALICE}`),
        interestDoc({ takerId: ALICE }),
      ),
    );
  });

  it("refuses a forged owner id, which would plant it in a stranger's inbox", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "interests", interestId),
        interestDoc({ shiftOwnerId: CAROL }),
      ),
    );
  });

  it("refuses interest in a shift that does not exist", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "interests", `ghost__${BOB}`),
        interestDoc({ shiftId: "ghost" }),
      ),
    );
  });

  it("refuses an interest that arrives pre-confirmed", async () => {
    await assertFails(
      setDoc(
        doc(db(BOB), "interests", interestId),
        interestDoc({ status: "confirmed" }),
      ),
    );
  });

  describe("visibility", () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const raw = context.firestore() as unknown as Firestore;
        await setDoc(doc(raw, "interests", interestId), interestDoc());
      });
    });

    it("is readable by the taker", async () => {
      await assertSucceeds(getDoc(doc(db(BOB), "interests", interestId)));
    });

    it("is readable by the shift owner", async () => {
      await assertSucceeds(getDoc(doc(db(ALICE), "interests", interestId)));
    });

    it("is invisible to everyone else", async () => {
      await assertFails(getDoc(doc(db(CAROL), "interests", interestId)));
    });

    it("lets the shift owner confirm it", async () => {
      await assertSucceeds(
        updateDoc(doc(db(ALICE), "interests", interestId), {
          status: "confirmed",
        }),
      );
    });

    it("stops the taker confirming their own interest", async () => {
      await assertFails(
        updateDoc(doc(db(BOB), "interests", interestId), {
          status: "confirmed",
        }),
      );
    });

    it("stops the owner rewriting the taker's details", async () => {
      await assertFails(
        updateDoc(doc(db(ALICE), "interests", interestId), {
          takerPhone: "972500000000",
        }),
      );
    });
  });
});

describe("the once-per-month דחיפות limit", () => {
  const lockId = `${BOB}__2026-08`;

  function lockDoc(overrides: Record<string, unknown> = {}) {
    return {
      uid: BOB,
      monthKey: "2026-08",
      shiftId: "urgent-1",
      createdAt: serverTimestamp(),
      expireAt: EXPIRE_AT,
      ...overrides,
    };
  }

  /**
   * Batched writes must all come from one Firestore instance, and `db()`
   * hands back a fresh one per call — so these tests hold a single handle.
   */
  function postUrgentShift(bob: Firestore, shiftId: string) {
    const batch = writeBatch(bob);
    batch.set(doc(bob, "shifts", shiftId), shiftDoc(BOB, { urgent: true }));
    batch.set(doc(bob, "urgencyLocks", lockId), lockDoc({ shiftId }));
    return batch.commit();
  }

  it("allows the first urgent shift of the month", async () => {
    await assertSucceeds(postUrgentShift(db(BOB), "urgent-1"));
  });

  it("rejects the second one, at the server", async () => {
    const bob = db(BOB);
    await postUrgentShift(bob, "urgent-1");

    // The lock already exists, so this write is an update — which the rules
    // do not permit — and the atomic batch takes the shift down with it.
    await assertFails(postUrgentShift(bob, "urgent-2"));
  });

  it("does not create the second shift either, since the batch is atomic", async () => {
    const bob = db(BOB);
    await postUrgentShift(bob, "urgent-1");
    await assertFails(postUrgentShift(bob, "urgent-2"));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      const rejected = await getDoc(doc(raw, "shifts", "urgent-2"));
      expect(rejected.exists()).toBe(false);
    });
  });

  it("still allows an urgent shift in a different month", async () => {
    const bob = db(BOB);
    await postUrgentShift(bob, "urgent-1");

    await assertSucceeds(
      setDoc(
        doc(bob, "urgencyLocks", `${BOB}__2026-09`),
        lockDoc({ monthKey: "2026-09" }),
      ),
    );
  });

  it("refuses a lock whose id does not match its owner", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "urgencyLocks", `${ALICE}__2026-08`), lockDoc()),
    );
  });

  it("refuses a lock claiming to belong to someone else", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "urgencyLocks", lockId), lockDoc({ uid: ALICE })),
    );
  });

  it("releases the lock when the intern deletes their urgent shift", async () => {
    await setDoc(doc(db(BOB), "urgencyLocks", lockId), lockDoc());
    await assertSucceeds(deleteDoc(doc(db(BOB), "urgencyLocks", lockId)));
  });

  it("stops one intern releasing another's lock", async () => {
    await setDoc(doc(db(BOB), "urgencyLocks", lockId), lockDoc());
    await assertFails(deleteDoc(doc(db(ALICE), "urgencyLocks", lockId)));
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
