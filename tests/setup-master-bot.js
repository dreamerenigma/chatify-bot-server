import { db } from '../src/config/firebase.js';

const MASTER_BOT_ID = 'xBf8ZwwJVSx7qg2G56X1';

const masterBot = {
  name: 'MasterBot',
  username: 'masterbot',
  isSystem: true,
  ownerId: 'system',
  ownerType: 'system',
  role: 'orchestrator',
  isActive: true,
  isVerified: true,
  type: 'utility',
  usersCount: 1,
};

const botsRef = db.collection('Bots');

const duplicates = await botsRef.where('username', '==', 'masterbot').where('isSystem', '==', true).get();

const batch = db.batch();

duplicates.docs.forEach((document) => {
  if (document.id !== MASTER_BOT_ID) {
    batch.delete(document.ref);
  }
});

await batch.commit();

await botsRef.doc(MASTER_BOT_ID).set({
  ...masterBot,
  createdAt: new Date(),
  updatedAt: new Date(),
});

console.log('Test MasterBot initialized.');
