const express = require('express');
const router = express.Router()

const userRoutes = require('./users.router')
const teamRoutes = require('./teams.router')
const reportRoutes = require('./reports.router')

const { verifyTokenMiddleware } = require('../middlewares/auth.middleware')

router.use('/users', userRoutes);
router.use('/teams', verifyTokenMiddleware, teamRoutes);
router.use('/reports', verifyTokenMiddleware, reportRoutes);

module.exports = router;