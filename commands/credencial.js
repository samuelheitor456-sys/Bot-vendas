const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('credencial')
    .setDescription('Configura a credencial do Mercado Pago (Access Token)')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('Seu Access Token do Mercado Pago (começa com TEST- ou APP-)')
        .setRequired(true)),

  async execute(interaction) {
    const adminRole = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
    }

    const token = interaction.options.getString('token');

    // Validação corrigida: aceita tanto hífen quanto underscore
    if (!token.startsWith('TEST-') && !token.startsWith('APP-') && !token.startsWith('TEST_') && !token.startsWith('APP_')) {
      return interaction.reply({ content: '❌ Token inválido. Deve começar com TEST- (teste) ou APP- (produção) (também aceita TEST_ ou APP_).', ephemeral: true });
    }

    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES ('mp_access_token', ?)`, [token], function(err) {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao salvar credencial.', ephemeral: true });
      }
      interaction.reply({ content: '✅ Credencial do Mercado Pago configurada com sucesso!', ephemeral: true });
    });
  }
};
