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
const studyAreaRoutes = require('./routes/studyArea.routes');
const socialRoutes = require('./routes/social.routes');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const defaultOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://sharedstudy.netlify.app',
];

const allowedOrigins = [
  ...defaultOrigins,
  ...(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean),
];

const isAllowedRailwayPreview = (origin) => {
  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith('.up.railway.app');
  } catch (err) {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.ALLOW_ALL_ORIGINS === 'true') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (isAllowedRailwayPreview(origin)) return callback(null, true);

    return callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
  },
  credentials: true,
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

const uploadsRoot = path.join(__dirname, '../uploads');
fs.mkdirSync(path.join(uploadsRoot, 'resumes'), { recursive: true });
fs.mkdirSync(path.join(uploadsRoot, 'profiles'), { recursive: true });
fs.mkdirSync(path.join(uploadsRoot, 'stories'), { recursive: true });

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'studyshare-api' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/users', userRoutes);
app.use('/api/study-areas', studyAreaRoutes);
app.use('/api/social', socialRoutes);

app.get('/', (req, res) => {
  res.send('StudyShare API is running');
});

app.listen(PORT, HOST, () => {
  console.log(`StudyShare API running at http://${HOST}:${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
});
