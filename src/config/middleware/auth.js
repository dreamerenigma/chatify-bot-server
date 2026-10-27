import { auth } from '../firebase.js';

export async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Требуется авторизация.',
    });
  }

  const idToken = authorization.slice(7).trim();

  if (!idToken) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Firebase ID Token отсутствует.',
    });
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
    };

    return next();
  } catch {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Недействительный или истёкший токен.',
    });
  }
}
