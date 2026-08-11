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

describe("the one-shift-per-date limit", () => {
  const lockId = `${BOB}__2026-08-25`;

  function dailyLockDoc(overrides: Record<string, unknown> = {}) {
    return {
      uid: BOB,
      date: "2026-08-25",
      monthKey: "2026-08",
      shiftId: "shift-a",
      createdAt: serverTimestamp(),
      expireAt: EXPIRE_AT,
      ...overrides,
    };
  }

  it("allows the first shift dated this day", async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), "dailyLocks", lockId), dailyLockDoc()),
    );
  });

  it("rejects a second shift dated the same day, at the server", async () => {
    const bob = db(BOB);
    await setDoc(doc(bob, "dailyLocks", lockId), dailyLockDoc());

    // The lock already exists, so this is an update, which is denied.
    await assertFails(
      setDoc(doc(bob, "dailyLocks", lockId), dailyLockDoc({ shiftId: "shift-b" })),
    );
  });

  it("still allows a shift dated a different day", async () => {
    await assertSucceeds(
      setDoc(
        doc(db(BOB), "dailyLocks", `${BOB}__2026-08-26`),
        dailyLockDoc({ date: "2026-08-26" }),
      ),
    );
  });

  it("refuses a lock whose id does not match its owner", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "dailyLocks", `${ALICE}__2026-08-25`), dailyLockDoc()),
    );
  });

  it("refuses a lock claiming to belong to someone else", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "dailyLocks", lockId), dailyLockDoc({ uid: ALICE })),
    );
  });

  it("does not refund the day when the shift is deleted", async () => {
    await setDoc(doc(db(BOB), "dailyLocks", lockId), dailyLockDoc());
    await assertFails(deleteDoc(doc(db(BOB), "dailyLocks", lockId)));
  });
});

describe("the four-a-month posting limit", () => {
  const lockId = `${BOB}__2026-08`;

  function countDoc(count: number, overrides: Record<string, unknown> = {}) {
    return {
      uid: BOB,
      monthKey: "2026-08",
      count,
      expireAt: EXPIRE_AT,
      ...overrides,
    };
  }

  // The create rule only allows a counter to start at 1, so a seed above
  // that has to bypass rules.
  async function seedCount(count: number) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      await setDoc(doc(raw, "handoffCounts", lockId), countDoc(count));
    });
  }

  it("allows the first shift of the month to create the counter at 1", async () => {
    await assertSucceeds(
      setDoc(doc(db(BOB), "handoffCounts", lockId), countDoc(1)),
    );
  });

  it("refuses the counter starting anywhere but 1", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "handoffCounts", lockId), countDoc(2)),
    );
  });

  it("allows incrementing by exactly one, up to four", async () => {
    const bob = db(BOB);
    await setDoc(doc(bob, "handoffCounts", lockId), countDoc(1));
    await assertSucceeds(updateDoc(doc(bob, "handoffCounts", lockId), { count: 2 }));
    await assertSucceeds(updateDoc(doc(bob, "handoffCounts", lockId), { count: 3 }));
    await assertSucceeds(updateDoc(doc(bob, "handoffCounts", lockId), { count: 4 }));
  });

  it("rejects a fifth shift, at the server", async () => {
    await seedCount(4);
    const bob = db(BOB);
    await assertFails(updateDoc(doc(bob, "handoffCounts", lockId), { count: 5 }));
  });

  it("refuses a jump of more than one", async () => {
    const bob = db(BOB);
    await setDoc(doc(bob, "handoffCounts", lockId), countDoc(1));
    await assertFails(updateDoc(doc(bob, "handoffCounts", lockId), { count: 3 }));
  });

  it("allows decrementing by exactly one, refunding a slot", async () => {
    await seedCount(2);
    const bob = db(BOB);
    await assertSucceeds(updateDoc(doc(bob, "handoffCounts", lockId), { count: 1 }));
  });

  it("refuses a decrement of more than one", async () => {
    await seedCount(3);
    const bob = db(BOB);
    await assertFails(updateDoc(doc(bob, "handoffCounts", lockId), { count: 1 }));
  });

  it("refuses decrementing below zero", async () => {
    await seedCount(0);
    const bob = db(BOB);
    await assertFails(updateDoc(doc(bob, "handoffCounts", lockId), { count: -1 }));
  });

  it("refuses a counter claiming to belong to someone else", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "handoffCounts", lockId), countDoc(1, { uid: ALICE })),
    );
  });

  it("never deletes the counter document itself, even at zero", async () => {
    await seedCount(0);
    await assertFails(deleteDoc(doc(db(BOB), "handoffCounts", lockId)));
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
