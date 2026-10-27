
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';

function createFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, 'utf8'),
    );

    return initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return initializeApp();
}

const firebaseApp = createFirebaseApp();

export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
