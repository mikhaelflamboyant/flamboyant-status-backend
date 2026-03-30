const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

const sendWeeklyReminderEmail = async (to, name) => {
  await transporter.sendMail({
    from: `"Status Report - Flamboyant" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Lembrete: atualize o status dos seus projetos',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #534AB7;">Olá, ${name}!</h2>
        <p>Este é um lembrete para atualizar o <strong>status report</strong> dos seus projetos ativos.</p>
        <p>Acesse o sistema e preencha os destaques da semana, próximos passos e o farol de cada projeto.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block; margin-top: 16px; padding: 10px 20px; background: #534AB7; color: white; border-radius: 6px; text-decoration: none;">
          Acessar o sistema
        </a>
        <p style="margin-top: 24px; color: #888; font-size: 13px;">Equipe de Tecnologia · Grupo Flamboyant</p>
      </div>
    `
  })
}

module.exports = { sendWeeklyReminderEmail }