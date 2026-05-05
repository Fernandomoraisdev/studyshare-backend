const express = require('express');
const router = express.Router();
const studyAreaController = require('../controllers/studyArea.controller');

router.get('/', studyAreaController.listStudyAreas);

module.exports = router;
