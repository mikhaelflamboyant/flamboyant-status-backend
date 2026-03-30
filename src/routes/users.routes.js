const express = require('express')
const router = express.Router()
const { listUsers, getUserById, updateUserRole, listPendingUsers, approveUser, rejectUser, deleteUser } = require('../controllers/users.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listUsers)
router.get('/pending', listPendingUsers)
router.get('/:id', getUserById)
router.patch('/:id/role', updateUserRole)
router.patch('/:id/approve', approveUser)
router.patch('/:id/reject', rejectUser)
router.delete('/:id', deleteUser)

module.exports = router