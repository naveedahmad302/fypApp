/**
 * Deny-by-default — any path that isn't explicitly allowed must be
 * denied for every actor. This guards against the "dynamic collection
 * name from user input" attack class: even if an attacker convinces
 * the client to call `firestore().collection(<arbitrary-string>)`, the
 * rules layer rejects it.
 */
import {
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getEnv, teardownEnv } from './_helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await getEnv('demo-fypapp-deny-default');
});

afterAll(async () => {
  await teardownEnv();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// A representative grab-bag of unknown collection names — including
// names a malicious or buggy client might generate from user input
// (chat group names that haven't been allow-listed, dynamic search
// queries, "secret_admin" probes, etc).
const UNKNOWN_COLLECTIONS = [
  'admin_users',
  'connection_test',
  'secret_admin',
  'random_chat_name',
  // Punctuated paths that look like sub-collection traversal:
  'user_messages',
  'all_messages',
];

function aliceDb() {
  return env.authenticatedContext('alice-uid').firestore();
}

describe('deny-by-default for unknown collections', () => {
  test.each(UNKNOWN_COLLECTIONS)('signed-in user cannot read /%s', async (col) => {
    await assertFails(getDocs(collection(aliceDb(), col)));
  });

  test.each(UNKNOWN_COLLECTIONS)('signed-in user cannot write into /%s', async (col) => {
    await assertFails(
      setDoc(doc(aliceDb(), col, 'd1'), {
        payload: 'evil',
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('signed-in user cannot read foreign top-level "users-clone" doc', async () => {
    // A subtle attempt to bypass /users/{uid} rules by trying a sibling
    // collection name. Rules layer must still deny.
    await assertFails(getDoc(doc(aliceDb(), 'users_admin', 'alice-uid')));
  });
});
