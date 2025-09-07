const Team = require('../models/teams.model')

const Joi = require('joi')

const generateReportSchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required()
});

const generateReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = await generateReportSchema.validateAsync(
            req.query
        );

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const report = await Team.aggregate([
            {
                $match: {
                    isActive: true,
                    date: { $lte: end },
                    endDate: { $gte: start },
                },
            },
            {
                $lookup: {
                    from: "transactions",
                    let: { teamId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$teamId", "$$teamId"] },
                                date: { $gte: start, $lte: end },
                            },
                        },
                    ],
                    as: "transactions",
                },
            },
            {
                $addFields: {
                    collectedAmount: { $sum: "$transactions.collectedAmount" },
                    toBeCollectedAmount: {
                        $cond: [
                            { $gt: ["$totalWeek", 0] },
                            { $divide: ["$totalAmount", "$totalWeek"] },
                            0,
                        ],
                    },
                },
            },
            {
                $addFields: {
                    weekday: { $dayOfWeek: "$date" }, // 1=Sunday, 7=Saturday
                },
            },
            {
                $group: {
                    _id: "$weekday",
                    totalAmount: { $sum: "$totalAmount" },
                    collectedAmount: { $sum: "$collectedAmount" },
                    toBeCollectedAmount: { $sum: "$toBeCollectedAmount" },
                },
            },
            {
                $project: {
                    _id: 0,
                    weekday: "$_id",
                    totalAmount: 1,
                    collectedAmount: 1,
                    toBeCollectedAmount: 1,
                    remainingAmount: {
                        $subtract: ["$toBeCollectedAmount", "$collectedAmount"],
                    },
                },
            },
        ]);

        // Map Mongo dayOfWeek (1–7) to names
        const dayMap = {
            1: "Sunday",
            2: "Monday",
            3: "Tuesday",
            4: "Wednesday",
            5: "Thursday",
            6: "Friday",
            7: "Saturday",
        };

        const dayOrder = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ];

        // Replace weekday numbers with names
        const namedReport = report.map((r) => ({
            day: dayMap[r.weekday],
            totalAmount: r.totalAmount,
            collectedAmount: r.collectedAmount,
            toBeCollectedAmount: r.toBeCollectedAmount,
            remainingAmount: r.remainingAmount,
        }));

        // If the requested range is 7 days or fewer, return only the days that fall within the range (chronological).
        // For longer ranges, keep full-week ordering.
        const msPerDay = 24 * 60 * 60 * 1000;
        const rangeDays = Math.floor((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / msPerDay) + 1;

        let finalDays;
        if (rangeDays <= 7) {
            // build chronological list of day names from start to end
            const jsDayMap = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ];
            finalDays = [];
            for (let d = new Date(start); d <= end; d = new Date(d.getTime() + msPerDay)) {
                finalDays.push(jsDayMap[d.getDay()]);
            }
        } else {
            finalDays = dayOrder;
        }

        // Ensure requested days exist (fill with 0 if missing) and preserve order
        const orderedReport = finalDays.map((day) =>
            namedReport.find((r) => r.day === day) || {
                day,
                totalAmount: 0,
                collectedAmount: 0,
                toBeCollectedAmount: 0,
                remainingAmount: 0,
            }
        );

        // If start and end fall on the same calendar date, return only that day's data
        const isSameCalendarDay = (d1, d2) => {
            const a = new Date(d1);
            const b = new Date(d2);
            return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        };

        if (isSameCalendarDay(start, end)) {
            const jsDayMap = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ];
            const dayName = jsDayMap[start.getDay()];
            const singleDay = orderedReport.find((r) => r.day === dayName) || {
                day: dayName,
                totalAmount: 0,
                collectedAmount: 0,
                toBeCollectedAmount: 0,
                remainingAmount: 0,
            };

            const summary = {
                totalAmount: singleDay.totalAmount,
                collectedAmount: singleDay.collectedAmount,
                toBeCollectedAmount: singleDay.toBeCollectedAmount,
                remainingAmount: singleDay.remainingAmount,
            };

            return res.status(200).json({
                message: `Report generated successfully for ${ startDate }`,
                report: [singleDay],
                summary,
            });
        }

        // Build summary
        const summary = orderedReport.reduce(
            (acc, d) => {
                acc.totalAmount += d.totalAmount;
                acc.collectedAmount += d.collectedAmount;
                acc.toBeCollectedAmount += d.toBeCollectedAmount;
                acc.remainingAmount += d.remainingAmount;
                return acc;
            },
            {
                totalAmount: 0,
                collectedAmount: 0,
                toBeCollectedAmount: 0,
                remainingAmount: 0,
            }
        );

        res.status(200).json({
            message: `Report generated successfully from ${ startDate } to ${ endDate }`,
            report: orderedReport,
            summary,
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