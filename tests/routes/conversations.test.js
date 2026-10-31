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
});

afterEach(async () => {
  const messages = await conversationRef.collection('messages').get();

  const batch = db.batch();

  messages.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  batch.delete(conversationRef);

  await batch.commit();
});

after(() => {
  mock.restoreAll();
});

test('POST /conversations/:botId/messages saves user message', async () => {
  const response = await request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`) .send({text: USER_MESSAGE});

  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'ok');

  const message = response.body.message;

  assert.ok(message.id);
  assert.equal(message.conversationId, userId);
  assert.equal(message.senderId, userId);
  assert.equal(message.senderType, 'user');
  assert.equal(message.text, USER_MESSAGE);
  assert.equal(message.type, 'text');

  const messageDocument = await conversationRef.collection('messages').doc(message.id).get();

  assert.ok(messageDocument.exists);

  const savedMessage = messageDocument.data();

  assert.equal(savedMessage.text, USER_MESSAGE);
  assert.equal(savedMessage.senderId, userId);
  assert.equal(savedMessage.senderType, 'user');
  assert.equal(savedMessage.type, 'text');
  assert.ok(savedMessage.createdAt);

  const conversation = await conversationRef.get();

  assert.ok(conversation.exists);
  assert.equal(conversation.data().lastMessage, USER_MESSAGE);
  assert.ok(conversation.data().lastMessageAt);
});

test('GET /conversations/:botId/messages returns conversation history', async () => {
  const postResponse = await request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`).send({text: USER_MESSAGE});

  assert.equal(postResponse.status, 201);

  const response = await request(app) .get(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');

  assert.equal(response.body.conversation.id, userId);

  assert.equal(response.body.messages.length, 1);

  const message = response.body.messages[0];

  assert.equal(message.text, USER_MESSAGE);
  assert.equal(message.senderId, userId);
  assert.equal(message.senderType, 'user');
  assert.equal(message.type, 'text');
});

test('POST /conversations/:botId/messages returns 401 without authorization', async () => {
  const response = await request(app).post(`/conversations/${masterBot.id}/messages`).send({text: USER_MESSAGE});

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'unauthorized');
});

test('POST /conversations/:botId/messages rejects empty text', async () => {
  const response = await request(app).post(`/conversations/${masterBot.id}/messages`).set('Authorization', `Bearer ${TEST_TOKEN}`).send({text: '   '});

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'validation_error');
});
