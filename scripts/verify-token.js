import 'dotenv/config';
import { auth } from '../src/config/firebase.js';

const token = process.env.TEST_FIREBASE_TOKEN;

if (!token) {
  throw new Error('TEST_FIREBASE_TOKEN не задан.');
}

try {
  const decoded = await auth.verifyIdToken(token);

  console.log('Token is valid');
  console.log('UID:', decoded.uid);
  console.log('Project ID:', auth.app.options.projectId);
} catch (error) {
  console.error('Token verification failed:');
  console.error('Code:', error.code);
  console.error('Message:', error.message);

  process.exitCode = 1;
}
