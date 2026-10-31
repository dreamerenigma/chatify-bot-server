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
    `Done! Congratulations on your new bot. ` +
    `You will find it at https://chatify.ru/${bot.username}. ` +
    `You can now add a description, about section and profile picture ` +
    `to your bot, see /help for a list of commands.\n\n` +

    `By the way, when you've finished creating your cool bot, ` +
    `ping our Bot Support if you want a better username for it. ` +
    `Just make sure the bot is fully operational before you do this.\n\n` +

    `Use this token to access the HTTP API:\n` +
    `\`${bot.token}\`\n\n` +

    `Keep your token **secure** and **store it safely**, ` +
    `it can be used by anyone to control your bot.\n\n` +

    `For a description of the Bot API, see this page: ` +
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
          'и заканчиваться на `bot`. Попробуйте ещё раз:',
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
          text: 'Sorry, this username is already taken. ' + 'Please choose another one:',
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
