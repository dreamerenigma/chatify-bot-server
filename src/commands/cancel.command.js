import { deleteSession } from '../services/session.service.js';

export async function handleCancelCommand(context) {
  const { botId, conversationId, session } = context;

  if (!session) {
    return {
      text: 'У вас нет активного действия для отмены.',
    };
  }

  await deleteSession(botId, conversationId);

  return {
    text:
      'Действие отменено.\n\n' +
      'Вы можете начать заново, используя /newbot.',
  };
}
