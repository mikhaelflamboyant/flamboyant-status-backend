const express = require('express')
const router = express.Router()
const { requireRole } = require('../middlewares/role.middleware')
const {
  listProjects, listArchivedProjects, listGoLiveProjects, listBacklogProjects,
  getProjectById, createProject, updateProject, deleteProject, assignMember,
  approveFreshservice, rejectFreshservice, listFreshserviceRequests, assignResponsible,
  cancelProject, listCancelledProjects, restoreProject, duplicateProject,
  getMentionableUsers, getMentionableProjects
} = require('../controllers/projects.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/freshservice-requests', requireRole('ANALISTA_MASTER', 'COORDENADOR', 'GERENTE', 'SUPERINTENDENTE'), listFreshserviceRequests)
router.get('/', listProjects)
router.get('/archived', listArchivedProjects)
router.get('/go-live', listGoLiveProjects)
router.get('/backlog', requireRole('ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR', 'SUPERINTENDENTE', 'DIRETOR', 'SUPERVISOR', 'ANALISTA'), listBacklogProjects)
router.get('/mentionable-projects', getMentionableProjects)
router.get('/cancelled', listCancelledProjects)
router.post('/:id/assign', assignResponsible)
router.patch('/:id/cancel', cancelProject)
router.patch('/:id/restore', requireRole('ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR'), restoreProject)
router.get('/:id/mentionable-users', getMentionableUsers)
router.get('/:id', getProjectById)
router.post('/', createProject)
router.patch('/:id', updateProject)
router.delete('/:id', deleteProject)
router.post('/:id/members', assignMember)
router.patch('/:id/approve-freshservice', requireRole('ANALISTA_MASTER', 'COORDENADOR', 'GERENTE', 'SUPERINTENDENTE'), approveFreshservice)
router.delete('/:id/reject-freshservice', requireRole('ANALISTA_MASTER', 'COORDENADOR', 'GERENTE', 'SUPERINTENDENTE'), rejectFreshservice)
router.post('/:id/duplicate', duplicateProject)

module.exports = router