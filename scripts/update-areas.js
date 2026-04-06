const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const AREA_MAP = {
  'TI': 'Tecnologia da Informação',
  'RH': 'Pessoas e Cultura',
  'Jurídica': 'Jurídico',
  'Agropecuária': 'Agropecuária',
  'Construção': 'Engenharia',
  'Contabilidade': 'Contabilidade',
  'Controladoria': 'Controladoria',
  'Processos': 'Processos',
  'Depto. de Pessoas': 'Pessoas e Cultura',
  'Comitê Executivo': 'Processos',
  'Outros': 'Processos',
  'Financeiro': 'Financeiro',
  'Marketing': 'Marketing',
  'Segurança': 'Segurança',
  'Suprimentos': 'Suprimentos',
  'Shopping | Comercial e Relacionamento': 'Comercial e Relacionamento',
  'Shopping | Operações': 'Manutenção',
  'Shopping | Marketing': 'Marketing',
  'Shopping | Segurança e Estacionamento': 'Segurança',
  'Urbanismo | Engenharia': 'Engenharia',
  'Urbanismo | Incorporação': 'Incorporação',
  'Urbanismo | Financeiro': 'Financeiro',
  'Urbanismo | Relacionamento': 'Comercial e Relacionamento',
  'Urbanismo | Vendas': 'Vendas',
  'Urbanismo | Marketing': 'Marketing',
  'Instituto': 'Instituto',
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, area: true }
  })

  console.log(`\n${users.length} usuários encontrados\n`)

  let updated = 0
  let skipped = 0

  for (const user of users) {
    const newArea = AREA_MAP[user.area]

    if (newArea && newArea !== user.area) {
      await prisma.user.update({
        where: { id: user.id },
        data: { area: newArea }
      })
      console.log(`✓ ${user.name}: "${user.area}" → "${newArea}"`)
      updated++
    } else if (!newArea) {
      console.log(`⚠ ${user.name}: área "${user.area}" não mapeada — mantida`)
      skipped++
    } else {
      skipped++
    }
  }

  console.log(`\n✅ ${updated} usuários atualizados · ${skipped} sem alteração`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())