const express = require('express');
const router = express.Router()

const {
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
} = require('../controllers/teams.controller')

router.post('/', createTeam);
router.get('/:day', getAllTeams);
router.get('/single/:id', getSingleTeam);
router.put('/:id', editTeam);
router.delete('/:id', deleteTeam);
router.post('/members', addMember);
router.put('/members/:id', editMember);
router.delete('/members/:id', deleteMember);
router.get('/members/:id', getAllMembers);
router.get('/transactions/:teamId', getTransactions);
router.post('/transactions', addTransaction);
router.delete('/transactions/:id', deleteTransaction);

module.exports = router;