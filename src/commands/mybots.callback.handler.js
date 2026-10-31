import { handleMyBotsCommand, handleMyBotMenu } from './mybots.command.js';

export async function handleMyBotsCallback(context) {
  const { userId, callbackData } = context;

  if (typeof callbackData !== 'string' || !callbackData.trim()) {
    throw new Error('Не передан callbackData.');
  }

  if (callbackData === 'mybots') {
    return handleMyBotsCommand({ userId });
  }

  const parts = callbackData.split(':');

  if (parts[0] === 'mybot' && parts.length === 2) {
    return handleMyBotMenu({
      userId,
      botId: parts[1],
    });
  }

  throw new Error('Неизвестное действие inline-кнопки.');
}
