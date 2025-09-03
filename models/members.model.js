const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        caretaker: {
            type: String,
            required: true
        },
        aadharnumber: {
            type: String,
            match: /^\d{12}$/,
            required: true
        },
        photo: {
            type: String,
            default: null
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    },
    { timestamps: true }
);

const Member = mongoose.model('Member', memberSchema);
module.exports = Member;