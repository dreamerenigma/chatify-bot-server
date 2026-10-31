import { createBot } from '../services/bot.service.js';
import { createSession, updateSession, deleteSession } from '../services/session.service.js';

const COMMAND_NAME = 'newbot';

function getUsernamePrompt() {
  return (
    'Отлично! Теперь давайте выберем имя пользователя для вашего бота. ' +
    'Оно должно заканчиваться на `bot`. Например: TetrisBot или tetris_bot. '
  );
}

function getSuccessMessage(bot) {
  return (
    `Готово! Поздравляем с созданием нового бота🎉. ` +
    `Вы найдете бота по адресу: https://chatify.ru/${bot.username}. ` +
    `Теперь вы можете добавить описание, раздел «О нас» и фотографию профиля. ` +
    `Чтобы связаться с вашим ботом, см. /help для списка команд.\n\n` +

    `Кстати, когда закончите создание своего классного бота, ` +
    `напишите в нашу службу поддержки ботов, если захотите подобрать для него более удачное имя пользователя. ` +
    `Только убедитесь, что бот полностью готов к работе, прежде чем обращаться к нам.\n\n` +

    `Используйте этот токен для доступа к HTTP API:\n` +
    `\`${bot.token}\`\n\n` +

    `Храните свой токен в **безопасности** и **обеспечьте его надежное хранение**, ` +
    `любой человек может использовать это для управления вашим ботом.\n\n` +

    `Описание Bot API можно найти на этой странице: ` +
    `https://core.chatify.org/bots/api`
  );
}

export async function handleNewBotCommand(context) {
  const { botId, conversationId, userId, text, session } = context;

  if (!session) {
    await createSession({
      botId,
      conversationId,
      command: COMMAND_NAME,
      step: 'waiting_for_name',
      data: {},
    });

    return {
      text: 'Итак, новый бот. Как мы его назовём? Пожалуйста, выберите имя для своего бота.',
    };
  }

  if (session.step === 'waiting_for_name') {
    const name = text.trim();

    if (name.length < 3 || name.length > 64) {
      return {
        text: 'Название должно содержать от 3 до 64 символов. Попробуйте ещё раз.',
      };
    }

    await updateSession({
      botId,
      conversationId,
      step: 'waiting_for_username',
      data: { ...session.data, name },
    });

    return {
      text: getUsernamePrompt(),
    };
  }

  if (session.step === 'waiting_for_username') {
    const username = text.trim();

    if (!/^[a-zA-Z][a-zA-Z0-9_]{4,30}bot$/i.test(username)) {
      return {
        text:
          'Некорректный username.\n\n' +
          'Он должен начинаться с буквы, содержать только латинские буквы, цифры или `_` ' +
          'и заканчиваться на `bot`. Попробуйте ещё раз.',
      };
    }

    try {
      const bot = await createBot(userId, {
        name: session.data.name,
        username,
      });

      await deleteSession(botId, conversationId);

      return {
        text: getSuccessMessage(bot),
      };
    } catch (error) {
      if (error.code === 'USERNAME_TAKEN') {
        return {
          text: 'Этот username уже занят. Пожалуйста, выберите другой.',
        };
      }

      throw error;
    }
  }

  return {
    text:
      'Сценарий создания бота находится в неизвестном состоянии. ' +
      'Используйте /cancel и попробуйте снова.',
  };
}
