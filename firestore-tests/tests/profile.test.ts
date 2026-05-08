/**
 * /users/{uid} — profile rules.
 *
 * Invariants:
 *   * Only the owner may read or write their own profile document.
 *   * No anonymous reads anywhere (the legacy "authenticated user can
 *     read every other profile" hole is closed).
 *   * Owners cannot rewrite their own uid or createdAt timestamp.
 */
import {
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getEnv, teardownEnv } from './_helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await getEnv('demo-fypapp-profile');
});

afterAll(async () => {
  await teardownEnv();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const ALICE_UID = 'alice-uid';
const BOB_UID = 'bob-uid';

function aliceDb() {
  return env.authenticatedContext(ALICE_UID).firestore();
}
function bobDb() {
  return env.authenticatedContext(BOB_UID).firestore();
}
function anonDb() {
  return env.unauthenticatedContext().firestore();
}

async function seedAliceProfile() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
      uid: ALICE_UID,
      email: 'alice@example.com',
      fullName: 'Alice Adams',
      createdAt: new Date('2026-01-01'),
    });
  });
}

describe('/users/{uid} — read', () => {
  test('owner can read their own profile', async () => {
    await seedAliceProfile();
    await assertSucceeds(getDoc(doc(aliceDb(), 'users', ALICE_UID)));
  });

  test('another signed-in user CANNOT read someone else\'s profile', async () => {
    await seedAliceProfile();
    await assertFails(getDoc(doc(bobDb(), 'users', ALICE_UID)));
  });

  test('anonymous user CANNOT read profiles', async () => {
    await seedAliceProfile();
    await assertFails(getDoc(doc(anonDb(), 'users', ALICE_UID)));
  });
});

describe('/users/{uid} — create', () => {
  test('owner can create their profile with a valid schema', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: 'alice@example.com',
        fullName: 'Alice Adams',
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('owner CANNOT create a profile under a different uid', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', BOB_UID), {
        uid: BOB_UID,
        email: 'attacker@example.com',
        fullName: 'Impersonator',
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('owner CANNOT create a profile where the doc id and uid disagree', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE_UID), {
        uid: BOB_UID, // attempt to claim Bob's UID inside Alice's doc
        email: 'alice@example.com',
        fullName: 'Alice Adams',
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('signed-out user CANNOT create any profile', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: 'alice@example.com',
        fullName: 'Alice Adams',
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('/users/{uid} — update', () => {
  test('owner can update their own non-immutable fields', async () => {
    await seedAliceProfile();
    await assertSucceeds(
      setDoc(
        doc(aliceDb(), 'users', ALICE_UID),
        { fullName: 'Alice Renamed' },
        { merge: true },
      ),
    );
  });

  test('owner CANNOT rewrite their own uid', async () => {
    await seedAliceProfile();
    await assertFails(
      setDoc(
        doc(aliceDb(), 'users', ALICE_UID),
        { uid: BOB_UID },
        { merge: true },
      ),
    );
  });

  test('another user CANNOT modify someone else\'s profile', async () => {
    await seedAliceProfile();
    await assertFails(
      setDoc(
        doc(bobDb(), 'users', ALICE_UID),
        { fullName: 'Pwned' },
        { merge: true },
      ),
    );
  });

  test('owner can stamp lastLoginAt + updatedAt without disturbing immutables', async () => {
    // Mirrors what AuthContext.recordLoginInFirestore writes on every
    // sign-in via the auth-state listener.
    await seedAliceProfile();
    await assertSucceeds(
      setDoc(
        doc(aliceDb(), 'users', ALICE_UID),
        {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  });

  test('another user CANNOT stamp lastLoginAt on someone else\'s profile', async () => {
    await seedAliceProfile();
    await assertFails(
      setDoc(
        doc(bobDb(), 'users', ALICE_UID),
        { lastLoginAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  test('owner CANNOT rewrite createdAt while stamping lastLoginAt', async () => {
    await seedAliceProfile();
    await assertFails(
      setDoc(
        doc(aliceDb(), 'users', ALICE_UID),
        {
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp(), // attempt to forge account age
        },
        { merge: true },
      ),
    );
  });
});
