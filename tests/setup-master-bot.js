import { db } from '../src/config/firebase.js';

const MASTER_BOT_ID = 'EkvzSjnniZRnlhQ7mqoc';

const masterBot = {
  id: MASTER_BOT_ID,
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

await db.collection('Bots').doc(MASTER_BOT_ID).set({
  ...masterBot,
  createdAt: new Date(),
  updatedAt: new Date(),
});

console.log('Test MasterBot initialized.');
