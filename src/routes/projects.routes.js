const express = require('express')
const router = express.Router()
const { requireRole } = require('../middlewares/role.middleware')
const {
  listProjects, listArchivedProjects, listGoLiveProjects, getProjectById,
  createProject, updateProject, deleteProject, assignMember,
  approveFreshservice, rejectFreshservice, listFreshserviceRequests
} = require('../controllers/projects.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/freshservice-requests', requireRole('ANALISTA_MASTER', 'COORDENADOR', 'GERENTE', 'SUPERINTENDENTE'), listFreshserviceRequests)
router.get('/', listProjects)
router.get('/archived', listArchivedProjects)
router.get('/go-live', listGoLiveProjects)
router.get('/:id', getProjectById)
router.post('/', createProject)
router.patch('/:id', updateProject)
router.delete('/:id', deleteProject)
router.post('/:id/members', assignMember)
router.patch('/:id/approve-freshservice', requireRole('ANALISTA_MASTER', 'COORDENADOR', 'GERENTE', 'SUPERINTENDENTE'), approveFreshservice)
router.delete('/:id/reject-freshservice', requireRole('ANALISTA_MASTER', 'COORDENADOR', 'GERENTE', 'SUPERINTENDENTE'), rejectFreshservice)

module.exports = router