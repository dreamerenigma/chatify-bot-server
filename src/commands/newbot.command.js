import { createSession, updateSession } from '../services/session.service.js';

const COMMAND_NAME = 'newbot';

export async function handleNewBotCommand(context) {
  const { botId, conversationId, text, session } = context;

  if (!session) {
    await createSession({
      botId,
      conversationId,
      command: COMMAND_NAME,
      step: 'waiting_for_name',
      data: {},
    });

    return {
      text: 'Отлично! Давайте создадим нового бота.\n\nВведите имя вашего бота:',
    };
  }

  if (session.step === 'waiting_for_name') {
    const name = text.trim();

    if (name.length < 3 || name.length > 64) {
      return {
        text: 'Название должно содержать от 3 до 64 символов. Попробуйте ещё раз:',
      };
    }

    await updateSession({
      botId,
      conversationId,
      step: 'waiting_for_username',
      data: { name },
    });

    return {
      text:
        `Отлично! Имя бота: ${name}\n\n` +
        'Теперь придумайте username для бота.\n' +
        'Он должен заканчиваться на `bot`, например: MyAwesomeBot:',
    };
  }

  if (session.step === 'waiting_for_username') {
    const username = text.trim();

    if (!/^[a-zA-Z][a-zA-Z0-9_]{4,30}bot$/i.test(username)) {
      return {
        text:
          'Некорректный username.\n\n' +
          'Он должен начинаться с буквы, содержать только латинские буквы, цифры или `_` ' +
          'и заканчиваться на `bot`. Попробуйте ещё раз:',
      };
    }

    await updateSession({
      botId,
      conversationId,
      step: 'checking_username',
      data: { username },
    });

    return {
      text:
        `Username ${username} принят!\n\n` +
        'Следующий этап — проверка уникальности и создание бота.',
    };
  }

  return {
    text: 'Сценарий создания бота находится в неизвестном состоянии. Используйте /cancel и попробуйте снова.',
  };
}
