const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Gerenciar sorteios')
    .addSubcommand(sub =>
      sub.setName('criar')
        .setDescription('Criar sorteio')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do sorteio').setRequired(true))
        .addStringOption(opt => opt.setName('premio').setDescription('Prêmio').setRequired(true))
        .addIntegerOption(opt => opt.setName('dias').setDescription('Dias de duração').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sortear')
        .setDescription('Sortear vencedor')
        .addIntegerOption(opt => opt.setName('id').setDescription('ID do sorteio').setRequired(true))),

  async execute(interaction) {
    // Implementar conforme necessidade
    interaction.reply({ content: '⏳ Funcionalidade em desenvolvimento.', ephemeral: true });
  }
};
