import { randomUUID } from 'node:crypto';
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../../src/config/firebase.js';
import { getOrCreateConversation } from '../../src/services/conversation.service.js';
import { createMessage, getMessages } from '../../src/services/message.service.js';

const bots = db.collection('Bots');

const USER_MESSAGE = '/newbot';

const BOT_MESSAGE = 'Alright, a new bot. How are we going to call it?';

let botId;
let userId;
let conversationRef;

before(async () => {
  botId = `test-message-bot-${randomUUID()}`;

  await bots.doc(botId).set({
    name: 'Message Test Bot',
    username: `MessageTestBot_${randomUUID().replaceAll('-', '')}`,
    isActive: true,
  });
});

beforeEach(async () => {
  userId = `test-user-${randomUUID()}`;

  await getOrCreateConversation(botId, userId);

  conversationRef = bots.doc(botId).collection('conversations').doc(userId);
});

afterEach(async () => {
  if (!conversationRef) return;

  const messages = await conversationRef.collection('messages').get();

  const batch = db.batch();

  messages.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  batch.delete(conversationRef);

  await batch.commit();

  conversationRef = null;
});

after(async () => {
  if (botId) {
    await bots.doc(botId).delete();
  }
});

test('createMessage saves a user message with the correct text', async () => {
  const message = await createMessage({
    botId,
    conversationId: userId,
    senderId: userId,
    senderType: 'user',
    text: USER_MESSAGE,
  });

  assert.ok(message.id);
  assert.equal(message.conversationId, userId);
  assert.equal(message.senderId, userId);
  assert.equal(message.senderType, 'user');
  assert.equal(message.text, USER_MESSAGE);
  assert.equal(message.type, 'text');
  assert.ok(message.createdAt instanceof Timestamp);

  const conversation = await conversationRef.get();

  assert.equal(conversation.data().lastMessage, USER_MESSAGE);
  assert.ok(conversation.data().lastMessageAt instanceof Timestamp);
});

test('createMessage saves a bot reply with the correct text', async () => {
  const message = await createMessage({
    botId,
    conversationId: userId,
    senderId: botId,
    senderType: 'bot',
    text: BOT_MESSAGE,
  });

  assert.ok(message.id);
  assert.equal(message.conversationId, userId);
  assert.equal(message.senderId, botId);
  assert.equal(message.senderType, 'bot');
  assert.equal(message.text, BOT_MESSAGE);
  assert.equal(message.type, 'text');
  assert.ok(message.createdAt instanceof Timestamp);

  const conversation = await conversationRef.get();

  assert.equal(conversation.data().lastMessage, BOT_MESSAGE);
  assert.ok(conversation.data().lastMessageAt instanceof Timestamp);
});

test('getMessages returns the conversation history in the correct order', async () => {
  await createMessage({
    botId,
    conversationId: userId,
    senderId: userId,
    senderType: 'user',
    text: USER_MESSAGE,
  });

  await createMessage({
    botId,
    conversationId: userId,
    senderId: botId,
    senderType: 'bot',
    text: BOT_MESSAGE,
  });

  const messages = await getMessages(botId, userId);

  assert.equal(messages.length, 2);

  assert.deepEqual(messages.map((message) => message.text), [USER_MESSAGE, BOT_MESSAGE]);

  assert.deepEqual(
    messages.map((message) => message.senderType),
    ['user', 'bot'],
  );

  assert.deepEqual(messages.map((message) => message.senderId), [userId, botId]);

  messages.forEach((message) => {
    assert.ok(message.id);
    assert.equal(message.conversationId, userId);
    assert.equal(message.type, 'text');
    assert.ok(message.createdAt instanceof Timestamp);
  });
});
