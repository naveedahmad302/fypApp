#!/usr/bin/env node

// Deploy Firebase Firestore Rules
// Run with: node deploy-firebase-rules.js

const { execSync } = require('child_process');

console.log('🔥 Deploying Firebase Firestore Rules...');

try {
  // Deploy Firestore rules
  execSync('npx firebase deploy --only firestore:rules', { stdio: 'inherit' });
  console.log('✅ Firestore rules deployed successfully!');
} catch (error) {
  console.error('❌ Failed to deploy Firestore rules:', error.message);
  console.log('\n📝 Manual deployment steps:');
  console.log('1. Go to Firebase Console → Firestore Database → Rules');
  console.log('2. Copy the content of firestore.rules file');
  console.log('3. Paste it in the console and click Publish');
}
