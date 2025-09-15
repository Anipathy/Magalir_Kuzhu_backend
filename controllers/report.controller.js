const Team = require('../models/teams.model')
const Transaction = require('../models/transactions.model')

const Joi = require('joi')

const generateReportSchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
}).custom((value, helpers) => {
    if (new Date(value.startDate) > new Date(value.endDate)) {
        return helpers.message('"startDate" must be lesser than or equal to "endDate"');
    }
    return value;
}, "StartDate <= EndDate validation");


const MS_PER_DAY = 24 * 60 * 60 * 1000;
function normalizeStartOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addDays(d, days) {
    return new Date(d.getTime() + days * MS_PER_DAY);
}

/**
 * Build scheduled installment dates for a team:
 * installments[k] = teamStart + k*7  (k=0..totalWeek-1)
 */
function buildScheduledDates(teamStart, totalWeeks) {
    const arr = [];
    const start = normalizeStartOfDay(teamStart);
    for (let k = 0; k < totalWeeks; k++) {
        arr.push(addDays(start, k * 7));
    }
    return arr;
}

/**
 * Snap a candidate date to the first scheduled date >= candidate.
 * scheduled must be sorted ascending.
 * Returns null if none >= candidate.
 */
function snapToNextScheduled(scheduled, candidate) {
    const c = normalizeStartOfDay(candidate);
    for (const s of scheduled) {
        if (normalizeStartOfDay(s) >= c) return normalizeStartOfDay(s);
    }
    return null;
}

/**
 * startDateStr, endDateStr in ISO or any Date-parsable format.
 * Returns array of 7 objects in exact format you requested.
 */
async function getDayWiseReport(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) throw new Error('startDate and endDate required');

    const rangeStart = normalizeStartOfDay(new Date(startDateStr));
    const rangeEnd = normalizeStartOfDay(new Date(endDateStr));
    if (isNaN(rangeStart) || isNaN(rangeEnd) || rangeStart > rangeEnd) {
        throw new Error('Invalid date range');
    }

    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // init
    const result = weekDays.map(d => ({
        day: d,
        totalAmount: 0,
        collectedAmount: 0,
        toBeCollectedAmount: 0,
        remainingAmount: 0
    }));

    // fetch active teams
    const teams = await Team.find({ isActive: true }).lean();

    for (const team of teams) {
        // required fields guard
        if (!team.date || !team.totalAmount || !team.totalWeek || !team.day) continue;
        const teamStart = normalizeStartOfDay(new Date(team.date));
        const totalWeeks = Number(team.totalWeek) || 0;
        if (totalWeeks <= 0) continue;

        // scheduled installments
        const scheduled = buildScheduledDates(teamStart, totalWeeks);
        // does this team have ANY scheduled installment inside the requested range?
        const hasScheduledInRange = scheduled.some(sd => normalizeStartOfDay(sd) >= rangeStart && normalizeStartOfDay(sd) <= rangeEnd);
        if (!hasScheduledInRange) {
            // team not participating in this date range
            continue;
        }

        // find weekday bucket index from team.day
        const dayIndex = weekDays.indexOf(team.day);
        if (dayIndex === -1) continue;

        // accumulate team-level constants into that weekday only
        const teamTotal = Number(team.totalAmount || 0);
        const teamCollected = Number(team.collectedAmount || 0);
        result[dayIndex].totalAmount += teamTotal;
        result[dayIndex].collectedAmount += teamCollected;
        result[dayIndex].remainingAmount += (teamTotal - teamCollected);

        // weekly installment amount
        const weeklyInstallment = totalWeeks > 0 ? (teamTotal / totalWeeks) : 0;

        // determine first unpaid (effectiveNextDue):
        // if team.nextDue exists use it; else take (team.date + 7 days)
        const rawNext = team.nextDue ? normalizeStartOfDay(new Date(team.nextDue)) : addDays(teamStart, 7);
        // snap it to the nearest actual scheduled installment >= rawNext
        const effectiveNext = snapToNextScheduled(scheduled, rawNext);
        if (!effectiveNext) continue; // nothing to collect (next due beyond schedule)

        // Now sum all scheduled installments that are >= effectiveNext AND inside range
        for (const inst of scheduled) {
            const instNorm = normalizeStartOfDay(inst);
            if (instNorm < effectiveNext) continue;
            if (instNorm < rangeStart || instNorm > rangeEnd) continue;
            result[dayIndex].toBeCollectedAmount += weeklyInstallment;
        }
    }

    return result;
}

const generateReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = await generateReportSchema.validateAsync(req.query);
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "startDate and endDate required" });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const report = await getDayWiseReport(start, end);
        res.json({
            message: `Report generated successfully from ${ start } to ${ end }`,
            report
        });
    } catch (err) {
        next(err);
    }
};


module.exports = {
    generateReport,
}