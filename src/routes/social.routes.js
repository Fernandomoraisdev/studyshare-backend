const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const socialController = require('../controllers/social.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth.middleware');

const storyUploadsDir = path.join(__dirname, '../../uploads/stories');
fs.mkdirSync(storyUploadsDir, { recursive: true });

const storyStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storyUploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const storyUpload = multer({
  storage: storyStorage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return cb(null, true);
    return cb(new Error('Status aceita apenas imagem ou video.'));
  },
});

router.get('/friends', authMiddleware, socialController.listFriends);
router.get('/friends/requests', authMiddleware, socialController.listFriendRequests);
router.post('/friends/:id/request', authMiddleware, socialController.sendFriendRequest);
router.post('/friends/requests/:id/accept', authMiddleware, socialController.acceptFriendRequest);
router.post('/friends/requests/:id/decline', authMiddleware, socialController.declineFriendRequest);

router.get('/stories', optionalAuthMiddleware, socialController.listStories);
router.post('/stories', authMiddleware, storyUpload.single('media'), socialController.createStory);
router.delete('/stories/:id', authMiddleware, socialController.deleteStory);

router.get('/saved-resumes', authMiddleware, socialController.listSavedResumes);
router.post('/resumes/:id/repost', authMiddleware, socialController.toggleRepost);
router.post('/resumes/:id/share', optionalAuthMiddleware, socialController.createShare);
router.post('/resumes/:id/save', authMiddleware, socialController.toggleSaveResume);
router.post('/resumes/:id/contributions', authMiddleware, socialController.createContributionRequest);

router.get('/contributions', authMiddleware, socialController.listContributions);
router.post('/contributions/:id/status', authMiddleware, socialController.updateContributionStatus);

router.get('/notifications', authMiddleware, socialController.listNotifications);
router.post('/notifications/:id/read', authMiddleware, socialController.markNotificationRead);

module.exports = router;
