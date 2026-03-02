const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afiliado')
    .setDescription('Sistema de afiliados')
    .addSubcommand(sub =>
      sub.setName('registrar')
        .setDescription('Registrar-se como afiliado'))
    .addSubcommand(sub =>
      sub.setName('comissao')
        .setDescription('Ver comissões acumuladas')),

  async execute(interaction) {
    // Implementar conforme necessidade
    interaction.reply({ content: '⏳ Funcionalidade em desenvolvimento.', ephemeral: true });
  }
};
