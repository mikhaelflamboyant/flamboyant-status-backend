const { PrismaClient } = require('@prisma/client')
const { syncContactsFromAD } = require('../services/ldap.service')
const prisma = new PrismaClient()

const TI_AREA = 'Tecnologia da Informação'
const CAN_DELETE = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']

const listContacts = async (req, res) => {
  try {
    const { area } = req.query
    const where = area ? { area } : {}

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: [{ area: 'asc' }, { name: 'asc' }]
    })

    return res.status(200).json(contacts)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar contatos' })
  }
}

const createContact = async (req, res) => {
  try {
    const { name, area } = req.body

    if (!name || !area) {
      return res.status(400).json({ error: 'Nome e área são obrigatórios' })
    }

    const existing = await prisma.contact.findFirst({
      where: { name: name.trim(), area }
    })

    if (existing) {
      return res.status(200).json(existing)
    }

    const contact = await prisma.contact.create({
      data: { name: name.trim(), area }
    })

    return res.status(201).json(contact)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar contato' })
  }
}

const deleteContact = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    const isAllowed = CAN_DELETE.includes(requester.role) &&
      (requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role))

    if (!isAllowed) {
      return res.status(403).json({ error: 'Sem permissão para excluir contatos' })
    }

    const contact = await prisma.contact.findUnique({ where: { id } })
    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' })
    }

    await prisma.contact.delete({ where: { id } })
    return res.status(200).json({ message: 'Contato excluído com sucesso' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao excluir contato' })
  }
}

const syncContacts = async (req, res) => {
  try {
    const requester = req.user
    const isAllowed = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    if (!isAllowed) {
      return res.status(403).json({ error: 'Sem permissão para sincronizar contatos' })
    }

    const entries = await syncContactsFromAD()
    let created = 0
    let skipped = 0

    for (const entry of entries) {
      const existing = await prisma.contact.findFirst({
        where: { name: entry.name, area: entry.area }
      })
      if (existing) { skipped++; continue }
      await prisma.contact.create({ data: { name: entry.name, area: entry.area } })
      created++
    }

    return res.status(200).json({
      message: `Sincronização concluída: ${created} contatos adicionados, ${skipped} já existiam.`,
      created,
      skipped
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao sincronizar contatos do AD' })
  }
}

module.exports = { listContacts, createContact, deleteContact, syncContacts }