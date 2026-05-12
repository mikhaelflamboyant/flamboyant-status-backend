const express = require('express')
const router = express.Router()
const { listContacts, createContact, deleteContact } = require('../controllers/contacts.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listContacts)
router.post('/', createContact)
router.delete('/:id', deleteContact)

module.exports = router