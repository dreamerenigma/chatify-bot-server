import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';

const bots = db.collection('Bots');

const editableFields = [
  'name',
  'username',
  'description',
  'type',
  'avatar',
  'managedBotIds',
  'platforms',
  'capabilities',
  'isActive',
  'isVerified',
];

function createError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toBot(document) {
  return {
    ...document.data(),
    id: document.id,
  };
}

function assertRegularBot(data) {
  if (data.isSystem === true || data.ownerType === 'system') {
    throw createError(
      'Системные боты не поддерживаются этим API.',
      'SYSTEM_BOT_FORBIDDEN',
    );
  }
}

export async function getUserBots(uid) {
  const snapshot = await bots
    .where('ownerId', '==', uid)
    .get();

  return snapshot.docs.map(toBot);
}

export async function getBotById(uid, botId) {
  const document = await bots.doc(botId).get();

  if (!document.exists) {
    throw createError('Бот не найден.', 'BOT_NOT_FOUND');
  }

  const data = document.data();

  if (data.ownerId !== uid || data.isSystem === true) {
    throw createError('Бот не найден.', 'BOT_NOT_FOUND');
  }

  return toBot(document);
}

export async function createBot(uid, input) {
  assertRegularBot(input);

  if (typeof input.name !== 'string' || !input.name.trim() || typeof input.username !== 'string' || !input.username.trim()) {
    throw createError('Поля name и username обязательны.', 'VALIDATION_ERROR');
  }

  const botRef = bots.doc();

  const data = {
    name: input.name.trim(),
    username: input.username.trim(),
    description: typeof input.description === 'string' ? input.description : '',
    type: typeof input.type === 'string' ? input.type : 'general',
    role: 'standard',
    avatar: input.avatar ?? null,
    ownerId: uid,
    ownerType: 'user',
    managedBotIds: [],
    platforms: ['chatify'],
    capabilities: ['messaging'],
    isActive: true,
    isVerified: false,
    id: botRef.id,
    createdAt: FieldValue.serverTimestamp(),
  };

  await botRef.create(data);

  const createdDocument = await botRef.get();

  return toBot(createdDocument);
}

export async function updateBot(uid, botId, input) {
  assertRegularBot(input);

  const updates = {};

  for (const field of editableFields) {
    if (Object.hasOwn(input, field)) {
      updates[field] = input[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError(
      'Нет допустимых полей для обновления.',
      'VALIDATION_ERROR',
    );
  }

  const botRef = bots.doc(botId);

  await db.runTransaction(async (transaction) => {
    const document = await transaction.get(botRef);

    if (!document.exists) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    const current = document.data();

    if (
      current.ownerId !== uid ||
      current.isSystem === true ||
      current.ownerType === 'system'
    ) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    transaction.update(botRef, updates);
  });

  return getBotById(uid, botId);
}

export async function deleteBot(uid, botId) {
  const botRef = bots.doc(botId);

  await db.runTransaction(async (transaction) => {
    const document = await transaction.get(botRef);

    if (!document.exists) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    const data = document.data();

    if (
      data.ownerId !== uid ||
      data.isSystem === true ||
      data.ownerType === 'system'
    ) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    transaction.delete(botRef);
  });
}
