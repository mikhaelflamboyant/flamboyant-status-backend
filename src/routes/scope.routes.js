const express = require('express')
const router = express.Router({ mergeParams: true })
const {
  listScopeItems, createScopeItem, updateScopeItem,
  deleteScopeItem, requestApproval, approveScope, rejectScope,
  approveItems, rejectItems
} = require('../controllers/scope.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listScopeItems)
router.post('/', createScopeItem)
router.patch('/:id', updateScopeItem)
router.delete('/:id', deleteScopeItem)
router.post('/request-approval', requestApproval)
router.post('/approve', approveScope)
router.post('/reject', rejectScope)
router.post('/approve-items', approveItems)
router.post('/reject-items', rejectItems)

module.exports = router