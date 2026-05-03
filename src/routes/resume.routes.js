const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const resumeController = require('../controllers/resume.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth.middleware');

// Configuração do Multer para upload de arquivos
const resumeUploadsDir = path.join(__dirname, '../../uploads/resumes');
fs.mkdirSync(resumeUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumeUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/feed', optionalAuthMiddleware, resumeController.getFeed);
router.get('/folder/:folderId', optionalAuthMiddleware, resumeController.getResumesByFolder);
router.get('/search', optionalAuthMiddleware, resumeController.searchResumes);
router.post('/upload', authMiddleware, upload.single('resume'), resumeController.uploadResume);

router.get('/:id/download', resumeController.downloadResume);
router.get('/:id/comments', resumeController.getResumeComments);
router.post('/:id/comments', authMiddleware, resumeController.addResumeComment);
router.post('/:id/like', authMiddleware, resumeController.toggleLike);
router.post('/:id/file', authMiddleware, upload.single('resume'), resumeController.replaceResumeFile);
router.get('/:id/edit', authMiddleware, resumeController.getResumeForEdit);
router.put('/:id', authMiddleware, resumeController.updateResume);
router.delete('/:id', authMiddleware, resumeController.deleteResume);
router.get('/:id', optionalAuthMiddleware, resumeController.getResumeDetails);

module.exports = router;
