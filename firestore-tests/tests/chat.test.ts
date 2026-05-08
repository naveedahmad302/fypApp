/**
 * /parents_support_circle and /weekly_check_ins — chat rules.
 *
 * Schema written by GroupChatScreen.tsx / RealTimeGroupChatScreen.tsx:
 *   { text, userUid, userName, createdAt, image? }
 *
 * Invariants:
 *   * Anyone signed in can read the community feed.
 *   * Anonymous users cannot read or write.
 *   * Authors must claim themselves: userUid == request.auth.uid.
 *   * Only the original author may edit or delete a message.
 *   * Authors cannot rewrite the userUid or createdAt fields.
 *   * Either text OR image must be populated (no empty messages).
 *   * String length caps prevent payload abuse (text 4 KB, image 4 KB).
 */
import {
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getEnv, teardownEnv } from './_helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await getEnv('demo-fypapp-chat');
});

afterAll(async () => {
  await teardownEnv();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const ALICE_UID = 'alice-uid';
const BOB_UID = 'bob-uid';
const COLLECTIONS = ['parents_support_circle', 'weekly_check_ins'] as const;

function aliceDb() {
  return env.authenticatedContext(ALICE_UID).firestore();
}
function bobDb() {
  return env.authenticatedContext(BOB_UID).firestore();
}
function anonDb() {
  return env.unauthenticatedContext().firestore();
}

async function seedMessage(
  collectionName: string,
  authorUid: string,
  id = 'msg-1',
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionName, id), {
      text: 'hello',
      userUid: authorUid,
      userName: 'Test',
      createdAt: new Date('2026-01-01'),
    });
  });
}

describe.each(COLLECTIONS)('community feed: %s', (col) => {
  describe('read', () => {
    test('signed-in users can read messages', async () => {
      await seedMessage(col, ALICE_UID);
      await assertSucceeds(getDocs(collection(bobDb(), col)));
    });

    test('anonymous users CANNOT read messages', async () => {
      await seedMessage(col, ALICE_UID);
      await assertFails(getDocs(collection(anonDb(), col)));
    });
  });

  describe('create', () => {
    test('Alice can create a text message claiming her own uid', async () => {
      await assertSucceeds(
        addDoc(collection(aliceDb(), col), {
          text: 'gm',
          userUid: ALICE_UID,
          userName: 'Alice',
          createdAt: serverTimestamp(),
        }),
      );
    });

    test('Alice can create an image-only message', async () => {
      await assertSucceeds(
        addDoc(collection(aliceDb(), col), {
          image: 'https://example.com/cat.png',
          userUid: ALICE_UID,
          userName: 'Alice',
          createdAt: serverTimestamp(),
        }),
      );
    });

    test('Alice CANNOT impersonate Bob', async () => {
      await assertFails(
        addDoc(collection(aliceDb(), col), {
          text: 'I am Bob',
          userUid: BOB_UID,
          userName: 'Bob',
          createdAt: serverTimestamp(),
        }),
      );
    });

    test('empty messages (no text, no image) are rejected', async () => {
      await assertFails(
        addDoc(collection(aliceDb(), col), {
          userUid: ALICE_UID,
          userName: 'Alice',
          createdAt: serverTimestamp(),
        }),
      );
    });

    test('oversized text is rejected (>4096 chars)', async () => {
      await assertFails(
        addDoc(collection(aliceDb(), col), {
          text: 'a'.repeat(4001),
          userUid: ALICE_UID,
          userName: 'Alice',
          createdAt: serverTimestamp(),
        }),
      );
    });

    test('anonymous users CANNOT create messages', async () => {
      await assertFails(
        addDoc(collection(anonDb(), col), {
          text: 'spam',
          userUid: 'whatever',
          userName: 'spam',
          createdAt: serverTimestamp(),
        }),
      );
    });
  });

  describe('update', () => {
    test('original author can edit their own message text', async () => {
      await seedMessage(col, ALICE_UID);
      await assertSucceeds(
        setDoc(
          doc(aliceDb(), col, 'msg-1'),
          { text: 'edited' },
          { merge: true },
        ),
      );
    });

    test('Bob CANNOT edit Alice\'s message', async () => {
      await seedMessage(col, ALICE_UID);
      await assertFails(
        setDoc(
          doc(bobDb(), col, 'msg-1'),
          { text: 'pwned by bob' },
          { merge: true },
        ),
      );
    });

    test('original author CANNOT rewrite the userUid (steal authorship)', async () => {
      await seedMessage(col, ALICE_UID);
      await assertFails(
        setDoc(
          doc(aliceDb(), col, 'msg-1'),
          { userUid: BOB_UID },
          { merge: true },
        ),
      );
    });

    test('original author CANNOT rewrite createdAt (re-order feed)', async () => {
      await seedMessage(col, ALICE_UID);
      await assertFails(
        setDoc(
          doc(aliceDb(), col, 'msg-1'),
          { createdAt: new Date('2099-01-01') },
          { merge: true },
        ),
      );
    });
  });

  describe('delete', () => {
    test('original author can delete their own message', async () => {
      await seedMessage(col, ALICE_UID);
      await assertSucceeds(deleteDoc(doc(aliceDb(), col, 'msg-1')));
    });

    test('another user CANNOT delete someone else\'s message', async () => {
      await seedMessage(col, ALICE_UID);
      await assertFails(deleteDoc(doc(bobDb(), col, 'msg-1')));
    });

    test('anonymous user CANNOT delete any message', async () => {
      await seedMessage(col, ALICE_UID);
      await assertFails(deleteDoc(doc(anonDb(), col, 'msg-1')));
    });
  });
});
