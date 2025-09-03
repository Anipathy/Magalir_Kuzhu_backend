const {
    registerSuperAdmin,
    registerUser,
    editUser,
    login,
    deleteUser,
    getAllUsers
} = require('../controllers/users.controller')
const { verifyTokenMiddleware } = require('../middlewares/auth.middleware')

const express = require('express');
const router = express.Router()

router.post('/register_super_admin', registerSuperAdmin);
router.post('/login', login);
router.get('/', verifyTokenMiddleware, getAllUsers);
router.post('/register', verifyTokenMiddleware, registerUser);
router.put('/:id', verifyTokenMiddleware, editUser);
router.delete('/:id', verifyTokenMiddleware, deleteUser)

module.exports = router;