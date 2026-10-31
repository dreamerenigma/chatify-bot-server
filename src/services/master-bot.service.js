import { db } from '../config/firebase.js';

const MASTER_BOT_USERNAME = 'masterbot';

export async function getMasterBot() {
  const snapshot = await db.collection('Bots').where('username', '==', MASTER_BOT_USERNAME).where('isSystem', '==', true).limit(2).get();

  if (snapshot.empty) {
    const error = new Error('MasterBot не найден.');
    error.code = 'MASTER_BOT_NOT_FOUND';
    throw error;
  }

  if (snapshot.size > 1) {
    const error = new Error('Найдено несколько системных MasterBot.');
    error.code = 'MASTER_BOT_DUPLICATE';
    throw error;
  }

  const document = snapshot.docs[0];
  const data = document.data();

  if (data.ownerId !== 'system' || data.role !== 'orchestrator') {
    const error = new Error('Некорректная конфигурация MasterBot.');
    error.code = 'MASTER_BOT_INVALID';
    throw error;
  }

  return {
    ...data,
    id: document.id,
  };
}
