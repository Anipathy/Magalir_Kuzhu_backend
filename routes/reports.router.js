const express = require('express');
const router = express.Router()

const {
    generateReport,
    getDayReport
} = require('../controllers/report.controller')

router.get('/', generateReport)
router.get("/:day", getDayReport);

module.exports = router