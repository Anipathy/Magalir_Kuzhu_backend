const express = require('express');
const router = express.Router()

const {
    generateReport,
} = require('../controllers/report.controller')

router.get('/', generateReport)

module.exports = router