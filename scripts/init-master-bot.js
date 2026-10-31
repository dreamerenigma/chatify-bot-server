import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../src/config/firebase.js';

const MASTER_BOT_USERNAME = 'masterbot';

const masterBot = {
  name: 'MasterBot',
  username: MASTER_BOT_USERNAME,
  description: 'Системный координатор и оркестратор ботов Chatify.',
  type: 'utility',
  role: 'orchestrator',
  avatar: null,
  ownerId: 'system',
  ownerType: 'system',
  isSystem: true,
  managedBotIds: [],
  platforms: ['chatify'],
  capabilities: ['messaging', 'commands', 'notifications'],
  isActive: true,
  isVerified: true,
};

async function initMasterBot() {
  const botsRef = db.collection('Bots');

  const existingQuery = await botsRef
    .where('username', '==', MASTER_BOT_USERNAME)
    .where('isSystem', '==', true)
    .limit(2)
    .get();

  if (existingQuery.size > 1) {
    throw new Error('Обнаружено несколько системных MasterBot. Проверьте коллекцию Bots.');
  }

  let botRef;

  if (!existingQuery.empty) {
    botRef = existingQuery.docs[0].ref;

    console.log(`MasterBot уже существует: ${botRef.id}`);
  } else {
    botRef = botsRef.doc();

    console.log(`Создаём MasterBot с ID: ${botRef.id}`);
  }

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(botRef);

    transaction.set(
      botRef,
      {
        ...masterBot,
        id: botRef.id,
        createdAt: snapshot.exists && snapshot.data().createdAt
          ? snapshot.data().createdAt
          : FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  const searchRef = db.collection('global_search_index').doc(botRef.id);

  await searchRef.set({
    targetId: botRef.id,
    name: masterBot.name,
    nameLower: masterBot.name.toLowerCase(),
    subtitle: 'Системный бот Chatify',
    avatarUrl: null,
    type: 'bot',
    isSearchable: true,
  });

  console.log('MasterBot успешно инициализирован.');
  console.log(`Bot ID: ${botRef.id}`);
}

initMasterBot()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('Ошибка инициализации MasterBot:', error);
    process.exitCode = 1;
  });
