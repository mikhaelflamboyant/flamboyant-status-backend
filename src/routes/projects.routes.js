const express = require('express')
const router = express.Router()
const {
  listProjects, listArchivedProjects, getProjectById,
  createProject, updateProject, deleteProject, assignMember
} = require('../controllers/projects.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listProjects)
router.get('/archived', listArchivedProjects)
router.get('/:id', getProjectById)
router.post('/', createProject)
router.patch('/:id', updateProject)
router.delete('/:id', deleteProject)
router.post('/:id/members', assignMember)

module.exports = router