import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { db } from '../../src/config/firebase.js';
import { handleNewBotCommand } from '../../src/commands/newbot.command.js';
import { getCurrentSession, deleteSession } from '../../src/services/session.service.js';

const TEST_BOT_ID = 'test-master-bot';
const TEST_CONVERSATION_ID = 'test-newbot-conversation';
const TEST_USER_ID = 'test-newbot-user';

async function cleanupTestData() {
  await deleteSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

  const snapshot = await db.collection('Bots').where('ownerId', '==', TEST_USER_ID).get();

  await Promise.all(
    snapshot.docs.map(async (document) => {
      const data = document.data();

      await Promise.all([
        db.collection('BotUsernames').doc(data.username).delete(),
        db.collection('global_search_index').doc(document.id).delete(),
        document.ref.delete(),
      ]);
    })
  );

  await db.collection('BotUsernames').doc('takenbot').delete();
}

function createContext(overrides = {}) {
  return {
    botId: TEST_BOT_ID,
    conversationId: TEST_CONVERSATION_ID,
    userId: TEST_USER_ID,
    text: '',
    session: null,
    ...overrides,
  };
}

async function startCreation() {
  const result = await handleNewBotCommand(createContext({ text: '/newbot' }));

  const session = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

  return { result, session };
}

async function enterBotName(name) {
  const { session: initialSession } = await startCreation();

  const result = await handleNewBotCommand(
    createContext({
      text: name,
      session: initialSession,
    })
  );

  const session = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

  return {
    ...result,
    session,
  };
}

describe('handleNewBotCommand', { concurrency: false }, () => {
  beforeEach(async () => {
    await cleanupTestData();

    const session = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

    assert.equal( session, null, 'Перед тестом активная сессия должна отсутствовать');
  });

  afterEach(async () => {
    await cleanupTestData();

    const session = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

    assert.equal(session, null, 'После теста активная сессия должна отсутствовать');
  });

  it('should create a session when command starts', async () => {
    const { result, session } = await startCreation();

    assert.match(result.text, /новый бот/i);
    assert.ok(session);

    assert.equal(session.command, 'newbot');
    assert.equal(session.step, 'waiting_for_name');
    assert.deepEqual(session.data, {});
  });

  it('should reject a name shorter than 3 characters', async () => {
    const { session } = await startCreation();

    const result = await handleNewBotCommand(
      createContext({
        text: 'AB',
        session,
      })
    );

    assert.match(result.text, /от 3 до 64 символов/);

    const updatedSession = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

    assert.equal(updatedSession.step, 'waiting_for_name');
    assert.deepEqual(updatedSession.data, {});
  });

  it('should reject a name longer than 64 characters', async () => {
    const { session } = await startCreation();

    const result = await handleNewBotCommand(
      createContext({
        text: 'A'.repeat(65),
        session,
      })
    );

    assert.match(result.text, /от 3 до 64 символов/);

    const updatedSession = await getCurrentSession(TEST_BOT_ID,TEST_CONVERSATION_ID);

    assert.equal(updatedSession.step, 'waiting_for_name');
  });

  it('should accept a valid name and move to username step', async () => {
    const result = await enterBotName('  Weather Assistant  ');

    assert.match(result.text, /имя пользователя/i);
    assert.match(result.text, /заканчиваться на `bot`/);

    const session = await getCurrentSession(TEST_BOT_ID,TEST_CONVERSATION_ID);

    assert.equal(session.step, 'waiting_for_username');
    assert.equal(session.data.name, 'Weather Assistant');
  });

  it('should reject an invalid username and preserve the session', async () => {
    const { session } = await enterBotName('Weather Bot');

    const result = await handleNewBotCommand(
      createContext({
        text: '123invalidbot',
        session,
      })
    );

    assert.match(result.text, /Некорректный username/);

    const updatedSession = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

    assert.equal(updatedSession.step, 'waiting_for_username');
    assert.equal(updatedSession.data.name, 'Weather Bot');

    const botsSnapshot = await db.collection('Bots').where('ownerId', '==', TEST_USER_ID).get();

    assert.equal(botsSnapshot.size, 0);
  });

  it('should preserve the session when username is already taken', async () => {
    await db.collection('BotUsernames').doc('takenbot').set({
      botId: 'existing-test-bot',
    });

    const { session } = await enterBotName('Weather Bot');

    const result = await handleNewBotCommand(
      createContext({
        text: 'takenbot',
        session,
      })
    );

    assert.match(result.text, /username уже занят/i);

    const updatedSession = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

    assert.ok(updatedSession);
    assert.equal(updatedSession.step, 'waiting_for_username');
    assert.equal(updatedSession.data.name, 'Weather Bot');

    const botsSnapshot = await db.collection('Bots').where('ownerId', '==', TEST_USER_ID).get();

    assert.equal(botsSnapshot.size, 0);
  });

  it('should create a bot, return its token and delete the session', async () => {
    const { session: initialSession } = await enterBotName('Weather Assistant');
    
    const result = await handleNewBotCommand(
      createContext({
        text: 'weatherbot',
        session: initialSession,
      })
    );

    assert.match(result.text, /Готово!/);
    assert.ok(result.text.includes('https://chatify.ru/weatherbot'), 'Response should contain the bot URL');

    const tokenMatch = result.text.match(/`(chatify_[^`]+)`/);

    assert.ok(tokenMatch, 'Response should contain the bot token');

    const token = tokenMatch[1];

    const botsSnapshot = await db.collection('Bots').where('ownerId', '==', TEST_USER_ID).get();

    assert.equal(botsSnapshot.size, 1);

    const botDocument = botsSnapshot.docs[0];
    const bot = botDocument.data();

    assert.equal(bot.name, 'Weather Assistant');
    assert.equal(bot.username, 'weatherbot');
    assert.equal(bot.ownerId, TEST_USER_ID);
    assert.equal(bot.ownerType, 'user');
    assert.equal(bot.isSystem, false);

    assert.equal(bot.token, undefined);

    const expectedTokenHash = createHash('sha256').update(token).digest('hex');

    assert.equal(bot.tokenHash, expectedTokenHash);

    const usernameDocument = await db.collection('BotUsernames').doc('weatherbot').get();

    assert.ok(usernameDocument.exists);
    assert.equal(usernameDocument.data().botId, botDocument.id);

    const searchDocument = await db.collection('global_search_index').doc(botDocument.id).get();

    assert.ok(searchDocument.exists);
    assert.equal(searchDocument.data().username, 'weatherbot');
    assert.equal(searchDocument.data().name, 'Weather Assistant');
    assert.equal(searchDocument.data().isSearchable, true);

    const session = await getCurrentSession(TEST_BOT_ID, TEST_CONVERSATION_ID);

    assert.equal(session, null);
  });

  it('should handle an unknown session step', async () => {
    const { session } = await startCreation();

    const invalidSession = {
      ...session,
      step: 'unknown_step',
    };

    const result = await handleNewBotCommand(
      createContext({
        text: 'anything',
        session: invalidSession,
      })
    );

    assert.match(result.text, /неизвестном состоянии/);
    assert.ok(result.text.includes('/cancel'), 'Response should mention /cancel');

    const botsSnapshot = await db.collection('Bots').where('ownerId', '==', TEST_USER_ID).get();

    assert.equal(botsSnapshot.size, 0);
  });
});
