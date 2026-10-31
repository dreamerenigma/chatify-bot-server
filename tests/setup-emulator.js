if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Tests must run with Firestore Emulator. ' + 'Set FIRESTORE_EMULATOR_HOST before starting tests.');
}

process.env.FIREBASE_PROJECT_ID =process.env.GCLOUD_PROJECT || 'demo-chatify-tests';

delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
