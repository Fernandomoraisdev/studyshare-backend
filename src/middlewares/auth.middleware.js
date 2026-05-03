const jwt = require('jsonwebtoken');

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET ausente ou fraco no .env.');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Faca login para continuar.' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Sessao expirada. Faca login novamente.' });
  }
};

const optionalAuthMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return next();

  try {
    req.user = verifyToken(token);
  } catch (err) {
    req.user = undefined;
  }

  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware };
