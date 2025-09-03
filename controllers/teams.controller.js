const Team = require('../models/teams.model');
const Member = require('../models/members.model');
const Transaction = require('../models/transactions.model');
const mongoose = require('mongoose');

const Joi = require('joi');

function getNextDueDate(fromDate, targetDay, weekNumber = null) {
    const dayMap = {
        "Sunday": 0,
        "Monday": 1,
        "Tuesday": 2,
        "Wednesday": 3,
        "Thursday": 4,
        "Friday": 5,
        "Saturday": 6
    };

    const targetDayIndex = dayMap[targetDay];
    if (targetDayIndex === undefined) return null;

    const baseDate = new Date(fromDate);

    // Case 1: Create Team → just get the next occurrence
    if (!weekNumber) {
        const diff = (7 + targetDayIndex - baseDate.getDay()) % 7 || 7;
        baseDate.setDate(baseDate.getDate() + diff);
        return baseDate;
    }

    // Case 2: Transaction ops → calculate (weekNumber)th week's due date
    let firstDue = new Date(baseDate);
    const diff = (7 + targetDayIndex - firstDue.getDay()) % 7 || 7;
    firstDue.setDate(firstDue.getDate() + diff);

    // Add (weekNumber - 1) * 7 days
    firstDue.setDate(firstDue.getDate() + (weekNumber - 1) * 7);
    return firstDue;
}

async function calculateBalanceWeek(teamId, totalWeek) {
    const transactions = await Transaction.find({ teamId });
    if (!transactions.length) return totalWeek;

    const maxWeek = Math.max(...transactions.map(t => t.week));
    return Math.max(0, totalWeek - maxWeek);
}


const createTeamSchema = Joi.object({
    teamCode: Joi.number().required(),
    address: Joi.string().required(),
    date: Joi.date().required(),
    day: Joi.string().valid('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday').required(),
    totalAmount: Joi.number().greater(0).required(),
    totalWeek: Joi.number().greater(0).required()
}).custom((value, helpers) => {
    if (value.date && value.day) {
        const providedDay = new Date(value.date).toLocaleDateString("en-US", { weekday: "long" });
        if (providedDay !== value.day) {
            return helpers.message(`Provided date (${ value.date }) does not match the selected day (${ value.day })`);
        }
    }
    return value;
}, "Date-Day Validation");

const createTeam = async (req, res, next) => {
    try {
        const payload = await createTeamSchema.validateAsync(req.body);
        const existingTeam = await Team.findOne({
            teamCode: payload.teamCode,
            day: payload.day,
            isActive: true
        });
        if (existingTeam) {
            return res.status(400).json({ message: 'Team already exist' });
        }

        const userId = req.user.id;
        payload.createdBy = userId;
        payload.nextDue = getNextDueDate(payload.date, payload.day);
        const team = await Team.create(payload);
        const balanceWeek = await calculateBalanceWeek(team._id, team.totalWeek);
        team.balanceWeek = balanceWeek;
        await team.save();

        res.status(201).json({
            message: 'Team created successfully',
            team
        });
    } catch (error) {
        next(error);
    }
};

const getTeamSchema = Joi.object({
    day: Joi.string().valid('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday').required(),
});

const getAllTeams = async (req, res, next) => {
    try {
        const { page, page_size, search } = req.query;
        const { day } = await getTeamSchema.validateAsync(req.params);
        const conditions = [
            { isActive: true },
            { day }
        ];
        if (search) {
            conditions.push({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$teamCode" },
                        regex: `^${ search }`,
                        options: "i"
                    }
                }
            });
        }
        const query = { $and: conditions };
        const pageNumber = parseInt(page) || 1;
        const pageSize = parseInt(page_size) || 10;
        const total = await Team.countDocuments(query);
        const totalPages = Math.ceil(total / pageSize);
        const teams = await Team.find(query).sort({ createdAt: -1 })
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize).populate('createdBy', 'username').populate('updatedBy', 'username');
        res.status(200).json({ teams, total, totalPages });
    } catch (error) {
        next(error);
    }
}

const editTeamSchema = Joi.object({
    teamCode: Joi.number().optional(),
    address: Joi.string().optional(),
    date: Joi.date().optional(),
    day: Joi.string().valid('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday').optional(), totalAmount: Joi.number().greater(0).optional(), totalWeek: Joi.number().greater(0).optional(),
}).custom((value, helpers) => {
    if (value.date && value.day) {
        const providedDay = new Date(value.date).toLocaleDateString("en-US", { weekday: "long" });
        if (providedDay !== value.day) {
            return helpers.message(`Provided date (${ value.date }) does not match the selected day (${ value.day })`);
        }
    }
    return value;
}, "Date-Day Validation");

const editTeam = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = await editTeamSchema.validateAsync(req.body);
        const team = await Team.findById(id);
        if (!team) return res.status(400).json({ message: 'Team not found' });

        if ((payload.teamCode && !payload.day) || (payload.day && !payload.teamCode)) {
            return res.status(400).json({ message: 'Both team code and day are required to update' });
        }

        if (payload.teamCode && payload.day) {
            const existingTeam = await Team.findOne({
                teamCode: payload.teamCode,
                day: payload.day,
                isActive: true,
                _id: { $ne: id }
            });
            if (existingTeam) {
                return res.status(400).json({ message: 'Team with the same code and day already exists' });
            }
        }

        const transactions = await Transaction.find({ teamId: id });
        const collected = transactions.reduce((sum, t) => sum + t.collectedAmount, 0);
        const maxWeek = transactions.length > 0 ? Math.max(...transactions.map(t => t.week)) : 0;

        if (payload.totalAmount && payload.totalAmount < collected) {
            return res.status(400).json({
                message: `Total amount cannot be less than already collected amount (${ collected })`
            });
        }

        if (payload.totalWeek && payload.totalWeek < maxWeek) {
            return res.status(400).json({
                message: `Total week cannot be less than the highest recorded transaction week (${ maxWeek })`
            });
        }

        const userId = req.user.id;
        payload.updatedBy = userId;
        Object.assign(team, payload);

        const weeksLeft = team.totalWeek - maxWeek;
        const balanceLeft = team.totalAmount - collected;

        if (weeksLeft <= 0 || balanceLeft <= 0) {
            team.nextDue = null;
        } else {
            team.nextDue = getNextDueDate(team.date, team.day, maxWeek + 1);
        }

        const balanceWeek = await calculateBalanceWeek(team._id, team.totalWeek);
        team.balanceWeek = balanceWeek;

        await team.save();

        res.status(200).json({ message: 'Team updated successfully', team, balanceWeek });
    } catch (error) {
        next(error);
    }
};



const deleteTeam = async (req, res, next) => {
    try {
        const { id } = req.params;
        const team = await Team.findById(id);
        if (!team) return res.status(400).json({ message: 'Team not found' });
        team.isActive = false;
        await team.save();
        return res.status(200).json({ message: 'Team deleted successfully' });
    } catch (error) {
        next(error);
    }
}

const getSingleTeam = async (req, res, next) => {
    try {
        const { id } = req.params;
        const team = await Team.findById(id);
        if (!team) return res.status(400).json({ message: 'Team not found' });
        res.status(200).json({ team });
    } catch (error) {
        next(error);
    }
}

async function isAadharAvailableInActiveTeams(aadharnumber) {
    const member = await Member.findOne({ aadharnumber });
    if (!member) {
        return true;
    }
    const team = await Team.findOne({ _id: member.teamId, isActive: true });
    return !team;
}

const createMemberSchema = Joi.object({
    teamId: Joi.string().required(),
    name: Joi.string().required(),
    caretaker: Joi.string().required(),
    aadharnumber: Joi.string()
        .pattern(/^\d{12}$/)
        .required()
        .messages({
            'string.pattern.base': 'Aadhar number must be exactly 12 digits.'
        }),
    photo: Joi.string().uri().optional()
});

const addMember = async (req, res, next) => {
    try {
        const payload = await createMemberSchema.validateAsync(req.body);
        const userId = req.user.id;
        payload.createdBy = userId;
        const team = await Team.findById(payload.teamId);
        if (!team || !team.isActive) return res.status(400).json({ message: 'Team not found or inactive' });
        const isAvailable = await isAadharAvailableInActiveTeams(payload.aadharnumber);
        if (!isAvailable) return res.status(400).json({ message: 'Aadhar number already exists in an active team' });
        const member = await Member.create(payload);
        team.members.push(member._id);
        await team.save();
        res.status(201).json({ message: 'Member added successfully', member });
    } catch (error) {
        next(error);
    }
}

const editMemberSchema = Joi.object({
    name: Joi.string().optional(),
    caretaker: Joi.string().optional(),
    aadharnumber: Joi.string()
        .pattern(/^\d{12}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Aadhar number must be exactly 12 digits.'
        }),
    photo: Joi.string().uri().optional()
});

const editMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = await editMemberSchema.validateAsync(req.body);
        const userId = req.user.id;
        payload.updatedBy = userId;
        const member = await Member.findById(id);
        if (!member) return res.status(400).json({ message: 'Member not found' });
        if (payload.aadharnumber && payload.aadharnumber !== member.aadharnumber) {
            const isAvailable = await isAadharAvailableInActiveTeams(payload.aadharnumber);
            if (!isAvailable) return res.status(400).json({ message: 'Aadhar number already exists in an active team' });
        }
        Object.assign(member, payload);
        await member.save();
        res.status(200).json({ message: 'Member updated successfully', member });
    } catch (error) {
        next(error);
    }
}

const deleteMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedMember = await Member.findByIdAndDelete(id);
        if (!deletedMember) {
            return res.status(400).json({ message: 'Member not found' });
        }
        await Team.updateMany(
            { members: new mongoose.Types.ObjectId(id) },
            { $pull: { members: new mongoose.Types.ObjectId(id) } }
        );
        res.status(200).json({ message: 'Member deleted successfully' });
    } catch (error) {
        next(error);
    }
}

const getAllMembers = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page, page_size, search } = req.query;
        const query = { teamId: id };
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        const pageNumber = parseInt(page) || 1;
        const pageSize = parseInt(page_size) || 10;
        const total = await Member.countDocuments(query);
        const totalPages = Math.ceil(total / pageSize);
        const members = await Member.find(query).sort({ createdAt: -1 })
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize);
        res.status(200).json({ members, total, totalPages });
    } catch (error) {
        next(error);
    }
}
const createTransactionSchema = Joi.object({
    teamId: Joi.string().required(),
    collectedAmount: Joi.number().greater(0).required(),
    date: Joi.date().required(),
    week: Joi.number().greater(0).required()
});

const addTransaction = async (req, res, next) => {
    try {
        const payload = await createTransactionSchema.validateAsync(req.body);
        const team = await Team.findById(payload.teamId);
        if (!team || !team.isActive) {
            return res.status(400).json({ message: 'Team not found or inactive' });
        }

        const totalCollected = team.collectedAmount + payload.collectedAmount;
        if (totalCollected > team.totalAmount) {
            return res.status(400).json({ message: 'Collected amount exceeds total amount for the team' });
        }

        const userId = req.user.id;
        payload.createdBy = userId;

        const transaction = await Transaction.create(payload);
        team.collectedAmount = totalCollected;

        const maxWeek = await Transaction.find({ teamId: team._id })
            .sort({ week: -1 })
            .limit(1)
            .then(res => (res.length ? res[0].week : 0));

        if (totalCollected >= team.totalAmount || maxWeek >= team.totalWeek) {
            team.nextDue = null;
        } else {
            team.nextDue = getNextDueDate(team.date, team.day, maxWeek + 1);
        }

        const balanceWeek = await calculateBalanceWeek(team._id, team.totalWeek);
        team.balanceWeek = balanceWeek;

        await team.save();

        res.status(201).json({
            message: 'Transaction added successfully',
            transaction,
            nextDue: team.nextDue,
            balanceWeek
        });
    } catch (error) {
        next(error);
    }
};

const deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const transaction = await Transaction.findById(id);
        if (!transaction) {
            return res.status(400).json({ message: 'Transaction not found' });
        }

        const team = await Team.findById(transaction.teamId);
        if (!team) {
            return res.status(400).json({ message: 'Associated team not found' });
        }

        team.collectedAmount = Math.max(0, team.collectedAmount - transaction.collectedAmount);
        await Transaction.findByIdAndDelete(id);

        const maxWeek = await Transaction.find({ teamId: team._id })
            .sort({ week: -1 })
            .limit(1)
            .then(res => (res.length ? res[0].week : 0));

        if (team.collectedAmount >= team.totalAmount || maxWeek >= team.totalWeek) {
            team.nextDue = null;
        } else if (maxWeek > 0) {
            team.nextDue = getNextDueDate(team.date, team.day, maxWeek + 1);
        } else {
            team.nextDue = getNextDueDate(team.date, team.day);
        }

        const balanceWeek = await calculateBalanceWeek(team._id, team.totalWeek);
        team.balanceWeek = balanceWeek;

        await team.save();

        res.status(200).json({
            message: 'Transaction deleted successfully',
            nextDue: team.nextDue,
            collectedAmount: team.collectedAmount,
            balanceWeek
        });
    } catch (error) {
        next(error);
    }
};


const getTransactions = async (req, res, next) => {
    try {
        const { teamId } = req.params;
        const { page, page_size } = req.query;
        const query = { teamId };
        const pageNumber = parseInt(page) || 1;
        const pageSize = parseInt(page_size) || 10;
        const total = await Transaction.countDocuments(query);
        const totalPages = Math.ceil(total / pageSize);
        const transactions = await Transaction.find(query).sort({ date: -1 })
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize).populate('createdBy', 'username');
        res.status(200).json({ transactions, total, totalPages });
    } catch (error) {
        next(error);
    }
}




module.exports = {
    createTeam,
    getAllTeams,
    editTeam,
    deleteTeam,
    getSingleTeam,
    addMember,
    editMember,
    deleteMember,
    getAllMembers,
    addTransaction,
    deleteTransaction,
    getTransactions
};