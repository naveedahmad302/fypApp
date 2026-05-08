/**
 * /users/{uid}/{assessments|reports|uploads|predictions}/{docId}
 *
 * These are the per-user owned subcollections. Ownership is enforced
 * by the path itself: only the matching authenticated UID may read or
 * write under their own user node. There is no cross-UID escape hatch.
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
  env = await getEnv('demo-fypapp-subcollections');
});

afterAll(async () => {
  await teardownEnv();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const ALICE_UID = 'alice-uid';
const BOB_UID = 'bob-uid';
const SUBCOLLECTIONS = ['assessments', 'reports', 'uploads', 'predictions'] as const;

function aliceDb() {
  return env.authenticatedContext(ALICE_UID).firestore();
}
function bobDb() {
  return env.authenticatedContext(BOB_UID).firestore();
}
function anonDb() {
  return env.unauthenticatedContext().firestore();
}

async function seedAlice(sub: string, id = 'doc-1') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, sub, id), {
      payload: { example: true },
      createdAt: new Date('2026-01-01'),
    });
  });
}

describe.each(SUBCOLLECTIONS)('/users/{uid}/%s', (sub) => {
  test('owner can write into their own subcollection', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), 'users', ALICE_UID, sub, 'd1'), {
        payload: { hello: 'world' },
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('owner can read their own subcollection', async () => {
    await seedAlice(sub);
    await assertSucceeds(
      getDoc(doc(aliceDb(), 'users', ALICE_UID, sub, 'doc-1')),
    );
  });

  test('another user CANNOT read someone else\'s subcollection', async () => {
    await seedAlice(sub);
    await assertFails(
      getDoc(doc(bobDb(), 'users', ALICE_UID, sub, 'doc-1')),
    );
  });

  test('another user CANNOT write into someone else\'s subcollection', async () => {
    await assertFails(
      setDoc(doc(bobDb(), 'users', ALICE_UID, sub, 'd1'), {
        payload: { evil: true },
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('anonymous user CANNOT touch any subcollection', async () => {
    await seedAlice(sub);
    await assertFails(
      getDoc(doc(anonDb(), 'users', ALICE_UID, sub, 'doc-1')),
    );
    await assertFails(
      setDoc(doc(anonDb(), 'users', ALICE_UID, sub, 'd2'), {
        payload: { evil: true },
        createdAt: serverTimestamp(),
      }),
    );
  });
});
