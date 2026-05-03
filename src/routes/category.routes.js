const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.get('/', categoryController.getAllCategories);
router.get('/:id/folders', categoryController.getCategoryFolders);
router.post('/', authMiddleware, categoryController.createCategory);
router.post('/folders', authMiddleware, categoryController.createFolder);

module.exports = router;
