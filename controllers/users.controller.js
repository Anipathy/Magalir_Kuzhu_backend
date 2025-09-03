const User = require('../models/users.model');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { generateToken } = require('../utils/jwt')

const registerSuperAdminSchema = Joi.object({
    username: Joi.string().lowercase().required(),
    password: Joi.string().required(),
    secretPassword: Joi.string().required(),
})

const registerSuperAdmin = async (req, res, next) => {
    try {
        const payload = await registerSuperAdminSchema.validateAsync(req.body);
        const existinmgUser = await User.findOne({ username: payload.username })
        if (existinmgUser) return res.status(400).json({ message: 'User already exists' });
        if (payload.secretPassword !== process.env.SECRET_PASSWORD) return res.status(400).json({ message: 'Secret password is incorrect' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(payload.password, salt);
        const user = await User.create({
            username: payload.username,
            password: hashedPassword,
            role: 'superadmin',
        });
        res.status(201).json({ message: 'Super admin registered successfully', user });
    } catch (error) {
        next(error)
    }
}

const createUserSchema = Joi.object({
    username: Joi.string().lowercase().required(),
    password: Joi.string().required(),
    role: Joi.string().valid('admin', 'user').required(),
})

const registerUser = async (req, res, next) => {
    try {
        const payload = await createUserSchema.validateAsync(req.body);
        const creatorRole = req.user.role
        if (!['admin', 'superadmin'].includes(creatorRole)) return res.status(400).json({ message: 'only admins & superadmins can create users' })
        const existingUser = await User.findOne({ username: payload.username });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(payload.password, salt);
        const user = await User.create({
            username: payload.username,
            password: hashedPassword,
            role: payload.role,
        });
        res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
        next(error)
    }
}

const editUserSchema = Joi.object({
    password: Joi.string().optional(),
    role: Joi.string().valid('admin', 'user').optional(),
})

const editUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ message: 'ID is required' });
        const payload = await editUserSchema.validateAsync(req.body);
        const creatorRole = req.user.role;
        if (creatorRole !== 'superadmin') return res.status(400).json({ message: 'Only superadmin can reset password' });
        const existingUser = await User.findById(id);
        if (!existingUser) return res.status(400).json({ message: 'User not found' });
        if (payload.role) existingUser.role = payload.role;
        if (payload.password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(payload.password, salt);
            existingUser.password = hashedPassword;
        }
        await existingUser.save();
        res.status(200).json({ message: `User ${ existingUser.username } updated successfully` });
    } catch (error) {
        next(error)
    }
}

const loginSchema = Joi.object({
    username: Joi.string().lowercase().required(),
    password: Joi.string().required()
})

const login = async (req, res, next) => {
    try {
        const payload = await loginSchema.validateAsync(req.body);
        const existingUser = await User.findOne({ username: payload.username });
        if (!existingUser) return res.status(400).json({ message: "user does not exist" });
        const isVerified = await bcrypt.compare(payload.password, existingUser.password);
        if (!isVerified) return res.status(400).json({ message: "incorrect password" });
        const token = await generateToken({ id: existingUser.id, username: existingUser.username, role: existingUser.role });
        return res.status(200).json({ message: 'login successful', token });
    } catch (error) {
        next(error)
    }
}

const deleteUser = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ message: 'ID is required' });
        const creatorRole = req.user.role;
        if (creatorRole !== 'superadmin') {
            return res.status(400).json({ message: 'Only superadmin can delete users' });
        }
        const existingUser = await User.findById(id);
        if (!existingUser) {
            return res.status(400).json({ message: 'User does not exist' });
        }
        await User.findByIdAndDelete(id);
        return res.status(200).json({ message: `User ${ existingUser.username } deleted successfully` });
    } catch (error) {
        next(error);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const { page, page_size, search } = req.query;
        const query = {};
        if (search) {
            query.username = { $regex: search, $options: 'i' };
        }
        const total = await User.countDocuments(query);
        const pageNumber = parseInt(page) || 1;
        const pageSize = parseInt(page_size) || 10;
        const totalPages = Math.ceil(total / pageSize);
        const users = await User.find(query).sort({ createdAt: -1 }).select('-password')
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize);
        res.status(200).json({ users, total, totalPages });
    } catch (error) {
        next(error);
    }
}


module.exports = {
    registerSuperAdmin,
    registerUser,
    editUser,
    login,
    deleteUser,
    getAllUsers
}