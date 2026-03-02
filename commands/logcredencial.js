const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logcredencial')
    .setDescription('Mostra a credencial do Mercado Pago atualmente configurada (apenas admin)'),

  async execute(interaction) {
    const adminRole = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
    }

    db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, row) => {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao buscar credencial.', ephemeral: true });
      }
      if (!row || !row.value) {
        return interaction.reply({ content: 'ℹ️ Nenhuma credencial configurada ainda.', ephemeral: true });
      }
      interaction.reply({ content: `🔑 Credencial atual: \`${row.value}\``, ephemeral: true });
    });
  }
};
