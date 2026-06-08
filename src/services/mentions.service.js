const prisma = require('../lib/prisma')
const logger = require('../lib/logger')

const TI_AREA = 'Tecnologia da Informação'

const USER_MENTION_REGEX = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g
const PROJECT_MENTION_REGEX = /\+\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g

const SOURCE_LABELS = {
  TASK: 'tarefa',
  SCOPE_ITEM: 'atividade do cronograma',
  REQUIREMENT: 'requisitos',
}

function parseMentions(text) {
  if (!text) return { userIds: [], projectIds: [] }
  const userIds = new Set()
  const projectIds = new Set()
  let m
  USER_MENTION_REGEX.lastIndex = 0
  while ((m = USER_MENTION_REGEX.exec(text)) !== null) userIds.add(m[1])
  PROJECT_MENTION_REGEX.lastIndex = 0
  while ((m = PROJECT_MENTION_REGEX.exec(text)) !== null) projectIds.add(m[1])
  return { userIds: [...userIds], projectIds: [...projectIds] }
}

async function getMentionableUserIds(project_id) {
  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      requesters: { include: { user: true } },
      members: { include: { user: true } },
    },
  })
  if (!project) return new Set()

  const ids = new Set()
  const consider = (user) => {
    if (user && user.status === 'ATIVO' && user.area === TI_AREA) ids.add(user.id)
  }
  for (const r of project.requesters) consider(r.user)
  for (const m of project.members) consider(m.user)
  return ids
}

async function syncMentions({ source_type, source_id, project_id, text, requester }) {
  const { userIds, projectIds } = parseMentions(text)

  const mentionable = await getMentionableUserIds(project_id)
  const validUserIds = userIds.filter(id => mentionable.has(id))
  const invalidUserIds = userIds.filter(id => !mentionable.has(id))

  let validProjectIds = []
  if (projectIds.length > 0) {
    const existing = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true },
    })
    validProjectIds = existing.map(p => p.id)
  }

  const previous = await prisma.mention.findMany({
    where: { source_type, source_id },
    select: { mentioned_user_id: true },
  })
  const previousUserIds = new Set(previous.map(p => p.mentioned_user_id).filter(Boolean))

  await prisma.mention.deleteMany({ where: { source_type, source_id } })

  const rows = [
    ...validUserIds.map(uid => ({
      source_type, source_id, project_id,
      mentioned_user_id: uid, mentioned_project_id: null,
      created_by: requester.id,
    })),
    ...validProjectIds.map(pid => ({
      source_type, source_id, project_id,
      mentioned_user_id: null, mentioned_project_id: pid,
      created_by: requester.id,
    })),
  ]
  if (rows.length > 0) {
    await prisma.mention.createMany({ data: rows })
  }

  const newUserIds = validUserIds.filter(
    uid => !previousUserIds.has(uid) && uid !== requester.id
  )
  if (newUserIds.length > 0) {
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      select: { title: true },
    })
    const contextLabel = SOURCE_LABELS[source_type] || 'projeto'
    for (const uid of newUserIds) {
      await prisma.notification.create({
        data: {
          user_id: uid,
          type: 'MENCAO',
          title: 'Você foi mencionado',
          body: `${requester.name} mencionou você em ${contextLabel} do projeto "${project?.title || ''}".`,
          link: `/projetos/${project_id}`,
        },
      })
    }
  }

  return { invalidUserIds }
}

module.exports = { parseMentions, getMentionableUserIds, syncMentions }