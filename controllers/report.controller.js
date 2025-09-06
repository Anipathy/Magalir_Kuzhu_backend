const Team = require('../models/teams.model')

const Joi = require('joi')

const generateReportSchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required()
});

const generateReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = await generateReportSchema.validateAsync(req.query);

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const report = await Team.aggregate([
            {
                $match: {
                    isActive: true,
                    date: { $lte: end },        // team started before report end
                    endDate: { $gte: start }    // team not finished before report start
                }
            },
            {
                $lookup: {
                    from: "transactions",
                    let: { teamId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$teamId", "$$teamId"] },
                                date: { $gte: start, $lte: end }
                            }
                        }
                    ],
                    as: "transactions"
                }
            },
            {
                $addFields: {
                    collectedAmount: { $sum: "$transactions.collectedAmount" },
                    remainingAmount: { $subtract: ["$totalAmount", { $sum: "$transactions.collectedAmount" }] }
                }
            },
            {
                $group: {
                    _id: "$day",
                    totalAmount: { $sum: "$totalAmount" },
                    collectedAmount: { $sum: "$collectedAmount" },
                    remainingAmount: { $sum: "$remainingAmount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    day: "$_id",
                    totalAmount: 1,
                    collectedAmount: 1,
                    remainingAmount: 1
                }
            }
        ]);

        const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const orderedReport = dayOrder.map(day =>
            report.find(r => r.day === day) || { day, totalAmount: 0, collectedAmount: 0, remainingAmount: 0 }
        );

        const summary = orderedReport.reduce(
            (acc, d) => {
                acc.totalAmount += d.totalAmount;
                acc.collectedAmount += d.collectedAmount;
                acc.remainingAmount += d.remainingAmount;
                return acc;
            },
            { totalAmount: 0, collectedAmount: 0, remainingAmount: 0 }
        );

        res.status(200).json({
            message: `Report generated successfully from ${ startDate } to ${ endDate }`,
            report: orderedReport,
            summary
        });
    } catch (error) {
        next(error);
    }
};




const getDayReportSchema = Joi.object({
    day: Joi.string().valid('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday').required(),
});


const getDayReport = async (req, res, next) => {
    try {
        const { day } = await getDayReportSchema.validateAsync(req.params); // e.g. "Monday"

        const teams = await Team.aggregate([
            { $match: { isActive: true, day } },
            {
                $lookup: {
                    from: "transactions",
                    localField: "_id",
                    foreignField: "teamId",
                    as: "transactions"
                }
            },
            {
                $addFields: {
                    collectedAmount: { $sum: "$transactions.collectedAmount" },
                    remainingAmount: { $subtract: ["$totalAmount", { $sum: "$transactions.collectedAmount" }] }
                }
            },
            {
                $project: {
                    _id: 1,
                    teamCode: 1,
                    teamName: 1,
                    totalAmount: 1,
                    collectedAmount: 1,
                    remainingAmount: 1,
                    nextDue: 1 // directly use stored field
                }
            }
        ]);

        // Day summary
        const summary = teams.reduce(
            (acc, t) => {
                acc.totalAmount += t.totalAmount;
                acc.collectedAmount += t.collectedAmount;
                acc.remainingAmount += t.remainingAmount;
                return acc;
            },
            { totalAmount: 0, collectedAmount: 0, remainingAmount: 0 }
        );

        res.status(200).json({
            message: `Report for ${ day }`,
            teams,
            summary
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    generateReport,
    getDayReport
}