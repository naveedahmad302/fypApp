/**
 * Shared bootstrap for the Firestore-rules emulator tests.
 *
 * `initializeTestEnvironment` reads ../firestore.rules at start-up so any
 * change to the rule file is picked up automatically. Each test file
 * gets its own RulesTestEnvironment because Jest runs files in parallel
 * processes, and we want hermetic state between files.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const RULES_PATH = path.resolve(__dirname, '..', '..', 'firestore.rules');

let cachedEnv: RulesTestEnvironment | null = null;

export async function getEnv(projectId: string): Promise<RulesTestEnvironment> {
  if (cachedEnv) return cachedEnv;
  const rules = fs.readFileSync(RULES_PATH, 'utf-8');
  cachedEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules,
      // The emulator host/port comes from $FIRESTORE_EMULATOR_HOST set
      // by `firebase emulators:exec`. We hard-default to localhost:8080
      // for direct `npm test` runs against an already-running emulator.
      host: '127.0.0.1',
      port: 8080,
    },
  });
  return cachedEnv;
}

export async function teardownEnv(): Promise<void> {
  if (cachedEnv) {
    await cachedEnv.cleanup();
    cachedEnv = null;
  }
}
