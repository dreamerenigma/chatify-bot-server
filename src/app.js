import 'dotenv/config';
import express from 'express';
import healthRouter from './routes/health.js';
import systemRouter from './routes/system.js';
import botsRouter from './routes/bots.js';
import conversationRouter from './routes/conversations.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRouter);
app.use('/system', systemRouter);
app.use('/bots', botsRouter);
app.use('/conversations', conversationRouter);

export default app;

const port = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Chatify Bot Server listening on port ${port}`);
  });
}
