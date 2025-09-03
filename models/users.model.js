const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'user'],
        required: true,
        default: 'user',
    }
}, {
    timestamps: true,
});

const User = mongoose.model('User', userSchema);
module.exports = User;