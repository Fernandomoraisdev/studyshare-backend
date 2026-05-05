const express = require('express');
const router = express.Router();
const socialController = require('../controllers/social.controller');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth.middleware');

router.get('/friends', authMiddleware, socialController.listFriends);
router.get('/friends/requests', authMiddleware, socialController.listFriendRequests);
router.post('/friends/:id/request', authMiddleware, socialController.sendFriendRequest);
router.post('/friends/requests/:id/accept', authMiddleware, socialController.acceptFriendRequest);
router.post('/friends/requests/:id/decline', authMiddleware, socialController.declineFriendRequest);

router.get('/stories', optionalAuthMiddleware, socialController.listStories);
router.post('/stories', authMiddleware, socialController.createStory);
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
