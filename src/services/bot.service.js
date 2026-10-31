import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';
import { syncBotSearchIndex, deleteBotSearchIndex } from './search-index.service.js';
import { createHash, randomBytes } from 'node:crypto';

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
  'isActive'
];

function createError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw createError( 'Поле username должно быть строкой.', 'VALIDATION_ERROR');
  }

  const username = value.trim().toLowerCase();

  if (!/^[a-z][a-z0-9_]{4,30}bot$/.test(username)) {
    throw createError('Некорректный username.', 'VALIDATION_ERROR');
  }

  return username;
}

function validateBotUpdates(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw createError('Тело запроса должно быть объектом.', 'VALIDATION_ERROR');
  }

  const allowedFields = new Set(editableFields);

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throw createError( `Поле ${field} нельзя изменить.`,'VALIDATION_ERROR');
    }
  }

  const updates = {};

  for (const [field, value] of Object.entries(input)) {
    switch (field) {
      case 'name':
        if (typeof value !== 'string' || !value.trim()) {
          throw createError('Поле name должно быть непустой строкой.', 'VALIDATION_ERROR');
        }
        updates.name = value.trim();
        break;
      case 'username':
        updates.username = normalizeUsername(value);
        break;
      case 'description':
        if (typeof value !== 'string') {
          throw createError('Поле description должно быть строкой.', 'VALIDATION_ERROR');
        }
        updates.description = value;
        break;
      case 'type':
        if (typeof value !== 'string' || !value.trim()) {
          throw createError('Поле type должно быть непустой строкой.','VALIDATION_ERROR');
        }
        updates.type = value.trim();
        break;
      case 'avatar':
        if (value !== null && typeof value !== 'string') {
          throw createError('Поле avatar должно быть строкой или null.','VALIDATION_ERROR',);
        }
        updates.avatar = value;
        break;
      case 'managedBotIds':
      case 'platforms':
      case 'capabilities':
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
          throw createError( `Поле ${field} должно быть массивом непустых строк.`, 'VALIDATION_ERROR');
        }
        updates[field] = value;
        break;
      case 'isActive':
        if (typeof value !== 'boolean') {
          throw createError('Поле isActive должно быть boolean.','VALIDATION_ERROR');
        }
        updates.isActive = value;
        break;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError('Нет допустимых полей для обновления.','VALIDATION_ERROR');
  }

  return updates;
}

function toBot(document) {
  return {
    ...document.data(),
    id: document.id,
  };
}

function assertRegularBot(data) {
  if (data.isSystem === true || data.ownerType === 'system') {
    throw createError('Системные боты не поддерживаются этим API.', 'SYSTEM_BOT_FORBIDDEN');
  }
}

export async function getUserBots(uid) {
  const snapshot = await bots.where('ownerId', '==', uid).get();

  return snapshot.docs.map(toBot);
}

export async function getBotById(uid, botId) {
  const document = await bots.doc(botId).get();

  if (!document.exists) {
    throw createError('Бот не найден.', 'BOT_NOT_FOUND');
  }

  const data = document.data();
  const isOwner = data.ownerId === uid;
  const isSystemOrchestrator = data.isSystem === true && data.ownerId === 'system' && data.ownerType === 'system' && data.role === 'orchestrator';

  if (!isOwner && !isSystemOrchestrator) {
    throw createError('Бот не найден.', 'BOT_NOT_FOUND');
  }

  return toBot(document);
}

export async function createBot(uid, input) {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw createError('Не указан владелец бота.', 'VALIDATION_ERROR');
  }

  if (!input || typeof input !== 'object') {
    throw createError('Некорректные данные бота.', 'VALIDATION_ERROR');
  }

  if (
    typeof input.name !== 'string' ||
    input.name.trim().length < 3 ||
    input.name.trim().length > 64
  ) {
    throw createError('Название должно содержать от 3 до 64 символов.', 'VALIDATION_ERROR');
  }

  const name = input.name.trim();
  const username = normalizeUsername(input.username);

  const botRef = bots.doc();
  const usernameRef = db.collection('BotUsernames').doc(username);

  const secret = randomBytes(32).toString('hex');
  const token = `chatify_${botRef.id}_${secret}`;

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const data = {
    id: botRef.id,
    name,
    username,
    description: '',
    type: 'general',
    role: 'standard',
    avatar: null,
    ownerId: uid,
    ownerType: 'user',
    managedBotIds: [],
    platforms: ['chatify'],
    capabilities: ['messaging'],
    isSystem: false,
    isActive: true,
    isVerified: false,
    usersCount: 0,
    tokenHash,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.runTransaction(async (transaction) => {
    const usernameDocument = await transaction.get(usernameRef);

    if (usernameDocument.exists) {
      throw createError( 'Этот username уже занят. Выберите другой.', 'USERNAME_TAKEN');
    }

    const existingBots = await transaction.get(bots.where('username', '==', username));

    if (!existingBots.empty) {
      throw createError('Этот username уже занят. Выберите другой.', 'USERNAME_TAKEN');
    }

    transaction.create(botRef, data);

    transaction.create(usernameRef, {
      botId: botRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  const createdDocument = await botRef.get();
  const bot = toBot(createdDocument);

  await syncBotSearchIndex(bot);

  return {
    ...bot,
    token,
  };
}

export async function addBotUser(uid, botId) {
  const botRef = bots.doc(botId);
  const botUserRef = db.collection('BotUsers').doc(`${botId}_${uid}`);

  await db.runTransaction(async (transaction) => {
    const botDocument = await transaction.get(botRef);

    if (!botDocument.exists) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    const botData = botDocument.data();
    
    if (botData.isActive !== true) {
      throw createError('Бот неактивен.', 'BOT_NOT_FOUND');
    }

    const botUserDocument = await transaction.get(botUserRef);

    if (botUserDocument.exists) {
      return;
    }

    transaction.create(botUserRef, {
      botId,
      userId: uid,
      addedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(botRef, {
      usersCount: FieldValue.increment(1),
    });
  });

  const updatedBot = await botRef.get();
  return toBot(updatedBot);
}

export async function updateBot(uid, botId, input) {
  assertRegularBot(input);

  const updates = validateBotUpdates(input);
  
  const botRef = bots.doc(botId);

  await db.runTransaction(async (transaction) => {
    const document = await transaction.get(botRef);

    if (!document.exists) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    const current = document.data();

    if (current.ownerId !== uid || current.isSystem === true ||current.ownerType === 'system') {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    transaction.update(botRef, updates);
  });

  const updatedBot = await getBotById(uid, botId);

  await syncBotSearchIndex(updatedBot);

  return updatedBot;
}

export async function deleteBot(uid, botId) {
  const botRef = bots.doc(botId);

  await db.runTransaction(async (transaction) => {
    const document = await transaction.get(botRef);

    if (!document.exists) {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    const data = document.data();

    if (data.ownerId !== uid || data.isSystem === true || data.ownerType === 'system') {
      throw createError('Бот не найден.', 'BOT_NOT_FOUND');
    }

    transaction.delete(botRef);
  });

  await deleteBotSearchIndex(botId);
}
