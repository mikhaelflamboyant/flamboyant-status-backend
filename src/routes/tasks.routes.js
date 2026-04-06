const express = require('express')
const router = express.Router({ mergeParams: true })
const { listTasks, createTask, updateTask, completeTask, deleteTask } = require('../controllers/tasks.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listTasks)
router.post('/', createTask)
router.patch('/:id', updateTask)
router.patch('/:id/complete', completeTask)
router.delete('/:id', deleteTask)

module.exports = router