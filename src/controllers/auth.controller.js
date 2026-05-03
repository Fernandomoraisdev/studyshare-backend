const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  area: true,
  photoUrl: true,
  bio: true,
};

const signToken = (user) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET ausente ou fraco no .env.');
  }

  return jwt.sign(
    { id: user.id, email: user.email, area: user.area },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const register = async (req, res) => {
  const { name, password, area } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!name?.trim() || !email || !area?.trim() || !password) {
    return res.status(400).json({ message: 'Preencha nome, e-mail, area e senha.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Informe um e-mail valido.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Este e-mail ja esta em uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        area: area.trim(),
      },
      select: publicUserSelect,
    });

    const token = signToken(user);
    res.status(201).json({ message: 'Cadastro realizado com sucesso!', token, user });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cadastrar.', error: err.message });
  }
};

const login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Credenciais invalidas.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciais invalidas.' });
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        area: user.area,
        photoUrl: user.photoUrl,
        bio: user.bio,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao fazer login.', error: err.message });
  }
};

module.exports = { register, login };
