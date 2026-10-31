import test, { before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../../src/app.js';
import { auth, db } from '../../src/config/firebase.js';
import { getMasterBot } from '../../src/services/master-bot.service.js';

const bots = db.collection('Bots');

const TEST_TOKEN = 'test-firebase-token';
const USER_MESSAGE = '/newbot';

let masterBot;
let userId;
let conversationRef;
let sessionRef;

before(async () => {
  masterBot = await getMasterBot();

  assert.equal(masterBot.isActive, true);

  mock.method(auth, 'verifyIdToken', async (token) => {
    if (token !== TEST_TOKEN) {
      throw new Error('Invalid test token.');
    }

    return { uid: userId };
  });
});

beforeEach(async () => {
  userId = `test-api-${randomUUID()}`;

  conversationRef = bots.doc(masterBot.id).collection('conversations').doc(userId);
  sessionRef = conversationRef.collection('sessions').doc('current');
});

afterEach(async () => {
  const messages = await conversationRef.collection('messages').get();

  const batch = db.batch();

  messages.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  batch.delete(sessionRef);

  batch.delete(conversationRef);

  await batch.commit();
});

after(() => {
  mock.restoreAll();
});

test('POST /conversations/:botId/messages saves user message and creates bot reply', async () => {
  const response = await request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`).send({ text: USER_MESSAGE });

  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'ok');

  const message = response.body.message;

  assert.ok(message.id);
  assert.equal(message.conversationId, userId);
  assert.equal(message.senderId, userId);
  assert.equal(message.senderType, 'user');
  assert.equal(message.text, USER_MESSAGE);
  assert.equal(message.type, 'text');

  const botMessage = response.body.botMessage;

  assert.ok(botMessage);
  assert.ok(botMessage.id);
  assert.equal(botMessage.conversationId, userId);
  assert.equal(botMessage.senderId, masterBot.id);
  assert.equal(botMessage.senderType, 'bot');
  assert.equal(botMessage.text, 'Итак, новый бот. Как мы его назовём? Пожалуйста, выберите имя для своего бота.');

  const messageDocument = await conversationRef.collection('messages').doc(message.id).get();

  assert.ok(messageDocument.exists);

  const savedMessage = messageDocument.data();

  assert.equal(savedMessage.text, USER_MESSAGE);
  assert.equal(savedMessage.senderId, userId);
  assert.equal(savedMessage.senderType, 'user');
  assert.equal(savedMessage.type, 'text');
  assert.ok(savedMessage.createdAt);

  const botMessageDocument = await conversationRef.collection('messages').doc(botMessage.id).get();

  assert.ok(botMessageDocument.exists);

  const sessionDocument = await sessionRef.get();

  assert.ok(sessionDocument.exists);

  const session = sessionDocument.data();

  assert.equal(session.command, 'newbot');
  assert.equal(session.step, 'waiting_for_name');
  assert.deepEqual(session.data, {});

  const conversation = await conversationRef.get();

  assert.ok(conversation.exists);
  assert.ok(conversation.data().lastMessage);
  assert.ok(conversation.data().lastMessageAt);
});

test('GET /conversations/:botId/messages returns conversation history', async () => {
  const postResponse = await request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`).send({ text: USER_MESSAGE });

  assert.equal(postResponse.status, 201);

  const response = await request(app).get(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');

  assert.equal(response.body.conversation.id, userId);
  assert.equal(response.body.messages.length, 2);

  const userMessage = response.body.messages.find((message) => message.senderType === 'user');

  const botMessage = response.body.messages.find((message) => message.senderType === 'bot');

  assert.ok(userMessage);
  assert.ok(botMessage);

  assert.equal(userMessage.text, USER_MESSAGE);
  assert.equal(userMessage.senderId, userId);
  assert.equal(userMessage.type, 'text');

  assert.equal(botMessage.senderId, masterBot.id);
  assert.match(botMessage.text, /Как мы его назовём/);
});

test('POST /conversations/:botId/messages completes the newbot flow', async () => {
  const sendMessage = (text) => request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`).send({ text });

  const startResponse = await sendMessage('/newbot');

  assert.equal(startResponse.status, 201);
  assert.equal(startResponse.body.message.text, '/newbot');

  assert.match(startResponse.body.botMessage.text, /Как мы его назовём/);

  let sessionDocument = await sessionRef.get();

  assert.ok(sessionDocument.exists);
  assert.equal(sessionDocument.data().command, 'newbot');
  assert.equal(sessionDocument.data().step, 'waiting_for_name');
  const nameResponse = await sendMessage('Chatify Helper');

  assert.equal(nameResponse.status, 201);
  assert.equal(nameResponse.body.message.text, 'Chatify Helper');

  assert.match(nameResponse.body.botMessage.text, /выберем имя пользователя/);

  sessionDocument = await sessionRef.get();

  assert.ok(sessionDocument.exists);
  assert.equal(sessionDocument.data().step, 'waiting_for_username');
  assert.equal(sessionDocument.data().data.name, 'Chatify Helper');

  const usernameResponse = await sendMessage('ChatifyHelperBot');

  assert.equal(usernameResponse.status, 201);
  assert.equal(usernameResponse.body.message.text, 'ChatifyHelperBot');

  assert.match(usernameResponse.body.botMessage.text, /Congratulations on your new bot/);

  assert.match(usernameResponse.body.botMessage.text, /You will find it at https:\/\/.+\/chatifyhelperbot\./);

  assert.match(usernameResponse.body.botMessage.text, /chatify_[a-zA-Z0-9]+_[a-f0-9]{64}/);

  sessionDocument = await sessionRef.get();

  assert.equal(sessionDocument.exists, false);

  const messages = await conversationRef.collection('messages').get();

  assert.equal(messages.size, 6);
});

test('POST /conversations/:botId/messages returns 401 without authorization', async () => {
  const response = await request(app).post(`/conversations/${masterBot.id}/messages`).send({ text: USER_MESSAGE });

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'unauthorized');
});

test('POST /conversations/:botId/messages rejects empty text', async () => {
  const response = await request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`).send({ text: '   ' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'validation_error');
});
