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
    const serviceAccount = JSON.parse( readFileSync(serviceAccountPath, 'utf8'));

    const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID;

    if (!projectId) {
      throw new Error('Firebase Project ID не найден.');
    }

    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    throw new Error( 'Не настроен Firebase. Укажите GOOGLE_APPLICATION_CREDENTIALS или FIREBASE_PROJECT_ID.');
  }

  return initializeApp({
    projectId,
  });
}

const firebaseApp = createFirebaseApp();

export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
