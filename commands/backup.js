const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Faz backup do banco de dados (admin)'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const dbPath = path.join(__dirname, '../produtos.db');
    if (!fs.existsSync(dbPath)) {
      return interaction.reply({ content: '❌ Banco de dados não encontrado.', ephemeral: true });
    }

    await interaction.reply({ content: '🔍 Gerando backup...', ephemeral: true });
    await interaction.editReply({ content: '✅ Backup realizado!', files: [dbPath], ephemeral: true });
  }
};
