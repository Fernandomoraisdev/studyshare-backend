require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const authRoutes = require('./routes/auth.routes');
const categoryRoutes = require('./routes/category.routes');
const resumeRoutes = require('./routes/resume.routes');
const tagRoutes = require('./routes/tag.routes');
const userRoutes = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

  app.use(cors({
    origin: [
      'http://localhost:5173',
      'https://sharedstudy.netlify.app'
    ],
    credentials: true
  }));
app.options('*', cors());
app.use(express.json());

// Garantir estrutura de pastas de upload
const uploadsRoot = path.join(__dirname, '../uploads');
fs.mkdirSync(path.join(uploadsRoot, 'resumes'), { recursive: true });
fs.mkdirSync(path.join(uploadsRoot, 'profiles'), { recursive: true });

// Servir arquivos estáticos (uploads de resumos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Documentação da API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('StudyShare API is running');
});

if (process.env.RUN_SEED === "true") {
  const { execSync } = require("child_process");

  console.log("🌱 Rodando seed manual...");

  try {
    execSync("npx prisma db push", { stdio: "inherit" });
    execSync("node prisma/seed.js", { stdio: "inherit" });
  } catch (e) {
    console.error("Erro ao rodar seed:", e);
  }
}

app.listen(PORT, HOST, () => {
  console.log("🚀 NOVA VERSÃO COM SEED ATIVO 🚀");
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
});
