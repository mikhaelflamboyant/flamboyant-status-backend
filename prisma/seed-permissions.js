const prisma = require('../src/lib/prisma')

// Chaves iguais �s do ProfilePermissionCards.jsx.
// enabled reflete o comportamento REAL do sistema hoje, para o seed
// n�o conceder nem tirar nada de ningu�m no primeiro deploy.
const SEED = {
  ESTAGIARIO: {
    'panel.personal': true,
    'projects.create': true,
    'projects.edit': true,
    'projects.delete': true,
    'requirements.create': true,
    'requirements.edit': true,
    'schedule.view': true,
    'schedule.create': true,
    'schedule.edit': true,
    'schedule.delete': true,
    'tasks.view': true,
    'tasks.create': true,
    'tasks.edit': true,
    'tasks.complete': true,
    'status_report.create': true,
    'status_report.edit': true,
    'status_report.delete': true,
  },
  ANALISTA: {
    'panel.personal': true,
    'projects.create': true,
    'projects.edit': true,
    'projects.delete': true,
    'projects.backlog': true,
    'requirements.create': true,
    'requirements.edit': true,
    'schedule.view': true,
    'schedule.create': true,
    'schedule.edit': true,
    'schedule.delete': true,
    'tasks.view': true,
    'tasks.create': true,
    'tasks.edit': true,
    'tasks.complete': true,
    'status_report.create': true,
    'status_report.edit': true,
    'status_report.delete': true,
    'docs.api': true,
  },
}

async function main() {
  let count = 0
  for (const [role, perms] of Object.entries(SEED)) {
    for (const [permission, enabled] of Object.entries(perms)) {
      await prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        update: {},
        create: { role, permission, enabled },
      })
      count++
    }
  }
  console.log(`Seed de permissoes concluido: ${count} registros processados.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
