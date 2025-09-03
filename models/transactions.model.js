const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    collectedAmount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now,
    },
    week: {
        type: Number,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;