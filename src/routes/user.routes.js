const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const userController = require('../controllers/user.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth.middleware');

// Upload de foto de perfil
const profileUploadsDir = path.join(__dirname, '../../uploads/profiles');
fs.mkdirSync(profileUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.post('/profile/photo', authMiddleware, upload.single('photo'), userController.uploadProfilePhoto);
router.get('/:id/summary', optionalAuthMiddleware, userController.getUserSummary);
router.get('/:id/followers', optionalAuthMiddleware, userController.listFollowers);
router.get('/:id/following', optionalAuthMiddleware, userController.listFollowing);
router.post('/:id/follow', authMiddleware, userController.toggleFollow);
router.get('/:id', optionalAuthMiddleware, userController.getPublicProfile);

module.exports = router;
