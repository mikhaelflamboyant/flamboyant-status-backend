const prisma = require('../src/lib/prisma')

const LEVEL_MAP = { A: 'A', B: 'B', C: 'C', D: 'D' }

const AN_AREA_MAP = {
  'Inovação': 'Inovação',
  'Marketing': 'Marketing Coorporativo',
  'Relacionamento': 'Relacionamento',
  'TI': 'Tecnologia da Informação',
  'RH': 'Pessoas e Cultura',
  'Contabilidade': 'Contabilidade',
  'Corporativo': 'Administração Pessoal',
  'Instituto': 'Instituto Flamboyant',
  'Segurança': 'Segurança',
  'Estacionamento': 'Estacionamento',
  'Central de Vendas': 'Vendas',
  'Agro': 'Agropecuária',
}

const UN_MAP = {
  'Corporativo': 'Corporativo',
  'Shopping': 'Shopping',
  'Urbanismo': 'Urbanismo',
  'Instituto': 'Instituto',
  'Agro': 'Agropecuária',
}

const projects = [
  // Demandas de sistemas
  { un: 'Corporativo', an: 'Inovação', title: 'Projeto de IA - Visão Computacional (parceria com UFG)', level: 'D' },
  { un: 'Corporativo', an: 'Inovação', title: 'Projeto de implantação de Wallet Flamboyant', level: 'A' },
  { un: 'Corporativo', an: 'Inovação', title: 'Flamboyant no Roblox', level: 'D' },
  { un: 'Shopping', an: 'Marketing', title: 'Implantar IA no atendimento de clientes multicanal', level: 'D' },
  { un: 'Corporativo', an: 'Inovação', title: 'Projeto de implantação de tiqueteira digital', level: 'D' },
  { un: 'Shopping', an: 'Relacionamento', title: 'Implantar novo sistema de gestão de Shopping (substituição do VS)', level: 'A' },
  { un: 'Corporativo', an: 'TI', title: 'Implantar ferramenta para gestão de código', level: 'C' },
  { un: 'Corporativo', an: 'RH', title: 'Melhoria nos indicadores de BI do RH', level: 'D' },
  { un: 'Corporativo', an: 'RH', title: "Implantar ferramenta para controle de EPI's (Quirons) - RH", level: 'C' },
  { un: 'Shopping', an: 'Marketing', title: 'Implantar solução de autoserviço para empréstimo de ativos (cadeira motorizada e carrinho de bebê)', level: 'D' },
  { un: 'Shopping', an: 'Estacionamento', title: 'Integração entre WPS e Unus academia', level: 'C' },
  { un: 'Corporativo', an: 'RH', title: 'Nova intranet do Grupo Flamboyant', level: 'D' },
  { un: 'Corporativo', an: 'RH', title: 'Ferramenta de treinamento corporativa', level: 'D' },
  { un: 'Corporativo', an: 'TI', title: 'Treinamento e disponibilização de ferramenta de IA para gerentes e coordenadores (Copilot)', level: 'D' },
  { un: 'Corporativo', an: 'RH', title: 'Implantação de portal de atração e seleção - RH', level: 'D' },
  { un: 'Corporativo', an: 'Corporativo', title: 'Implantar ferramenta de gestão de serviço para áreas de negócio (ESM)', level: 'D' },
  { un: 'Corporativo', an: 'Contabilidade', title: 'Integração com plataforma de captura de XML (Qive - Arquivei)', level: 'C' },
  { un: 'Corporativo', an: 'Contabilidade', title: 'Reforma Tributária - Mudanças para 2027', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'RPA - Implantar automatização em processos avaliados', level: 'B' },
  { un: 'Instituto', an: 'Instituto', title: 'Implantar ferramenta de CRM', level: 'A' },
  { un: 'Corporativo', an: 'TI', title: 'Migração de plataforma de integração (Sensedia Integrations -> N8N)', level: 'B' },
  { un: 'Urbanismo', an: 'Relacionamento', title: 'Implantar CRM para gestão da carteira de aluguéis', level: 'A' },
  { un: 'Corporativo', an: 'TI', title: 'Migrar integração facial (Sênior x IntranetMall) do Fluig para N8N', level: 'B' },
  { un: 'Urbanismo', an: 'Relacionamento', title: 'Portal do Cliente - Redesenho de tela de login', level: 'D' },
  { un: 'Urbanismo', an: 'Relacionamento', title: 'Checkpoint da jornada do cliente - eventos do RM -> CV', level: 'D' },
  { un: 'Corporativo', an: 'TI', title: 'Documentação e estruturação de processos de TI (Governança de TI)', level: 'C' },
  // Infraestrutura de TI
  { un: 'Corporativo', an: 'TI', title: 'Projeto de restruturação da videoconferência - JGE', level: 'A' },
  { un: 'Shopping', an: 'Segurança', title: 'Projeto de intertravamento de portas de emergência', level: 'C' },
  { un: 'Shopping', an: 'Segurança', title: 'Projeto de infraestrutura para instalação de câmeras nas galerias técnicas', level: 'C' },
  { un: 'Urbanismo', an: 'Central de Vendas', title: "Projeto para substituir AP's da Central de vendas pelo padrão utilizado no Mall", level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Instalação de sistema de supressão de incêndio (data center)', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Reavaliar contrato de outsourcing de impressão', level: 'B' },
  { un: 'Corporativo', an: 'TI', title: 'Alteração da hospedagem dos domínios do Grupo Flamboyant', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Projeto para substituição dos servidores do CFTV', level: 'C' },
  { un: 'Agro', an: 'Agro', title: 'Projeto de restruturação da rede de dados da Fazenda Malmequer', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Projeto de atualização de versão dos servidores com Windows Server 2019', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Reavaliar infraestrutura dos servidores do Data Center (Migração do workload para Cloud)', level: 'B' },
  { un: 'Shopping', an: 'Comercial', title: 'Substituição dos totens de Mall', level: 'B' },
  { un: 'Corporativo', an: 'TI', title: 'Implantar nova ferramenta para gerenciamento de EndPoints', level: 'C' },
  // Segurança da Informação
  { un: 'Corporativo', an: 'TI', title: 'Implantar solução ZTNA (Zero Trust Network Access) para controle dos acessos externos', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Reavaliar solução de endpoint security', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Projeto para classificar informações do Grupo Flamboyant (pública, interna, confidencial)', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Planejar e executar Pen Test na Infraestrutura do Grupo Flamboyant', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Reavaliar serviço de SOC implementado em 2025', level: 'C' },
  { un: 'Corporativo', an: 'TI', title: 'Documentação e estruturação dos processos de Segurança da Informação baseado em frameworks reconhecidos', level: 'C' },
]

async function main() {
  let created = 0
  let skipped = 0

  for (const p of projects) {
    const area = AN_AREA_MAP[p.an] || p.an
    const business_unit = UN_MAP[p.un] || p.un

    const existing = await prisma.project.findFirst({
      where: { title: p.title }
    })

    if (existing) {
      console.log(`⏭ Já existe: ${p.title}`)
      skipped++
      continue
    }

    await prisma.project.create({
      data: {
        title: p.title,
        area,
        business_unit,
        level: LEVEL_MAP[p.level],
        description: 'Não definida',
        requester_name: '',
        execution_type: 'INTERNA',
        traffic_light: 'VERDE',
        current_phase: 'BACKLOG',
        origin: 'NORMAL',
        completion_pct: 0,
        legacy: false,
      }
    })

    console.log(`✅ Criado: ${p.title}`)
    created++
  }

  console.log(`\nConcluído: ${created} criados, ${skipped} ignorados`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())