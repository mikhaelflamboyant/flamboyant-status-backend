const express = require('express')
const router = express.Router()
const { listPublicProjects, getPublicProject, listPublicArchivedProjects } = require('../controllers/public.controller')
const apiTokenMiddleware = require('../middlewares/apitoken.middleware')

router.use(apiTokenMiddleware)
router.get('/projects', listPublicProjects)
router.get('/projects/:id', getPublicProject)
router.get('/projects/archived', listPublicArchivedProjects)

module.exports = router