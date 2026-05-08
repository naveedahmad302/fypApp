# Firestore Security Rules — Unit Tests

Validates [`firestore.rules`](../firestore.rules) against the
@firebase/rules-unit-testing emulator. These tests exist because a
silent rule mis-match (e.g. expecting `authorId` while the app writes
`userUid`) can lock every user out of chat in production with no
warning. Each test asserts both the *allowed* and the *denied* path
for a single rule clause.

## Prerequisites

* Node ≥ 18 (project is tested on Node 22).
* Java 17 (for the Firebase emulator JVM). Already present in the
  Devin sandbox; on a fresh machine: `sudo apt-get install -y openjdk-17-jdk-headless`.
* `firebase-tools` global CLI:

  ```bash
  npm install -g firebase-tools
  ```

## Running

From the repository root:

```bash
cd firestore-tests
npm install
npx firebase --project=demo-fypapp-test emulators:exec --only firestore \
  'npm test'
```

The emulator starts on `localhost:8080` and is torn down automatically
when the Jest process exits. No real Firebase project is contacted —
the `demo-` prefix forces the SDK into emulator-only mode.

## Layout

* `tests/profile.test.ts` — `/users/{uid}` read/write isolation.
* `tests/chat.test.ts` — `/parents_support_circle` and
  `/weekly_check_ins` create/update/delete invariants.
* `tests/subcollections.test.ts` — `/users/{uid}/assessments|reports|uploads|predictions`.
* `tests/deny_by_default.test.ts` — random / dynamic collection names
  return permission-denied.

## Writing new tests

```ts
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
```

Always use `assertSucceeds` / `assertFails` rather than try/catch so the
test reports *which* expectation failed.
