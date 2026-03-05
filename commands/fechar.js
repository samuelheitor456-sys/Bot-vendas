const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fechar')
    .setDescription('Fecha um ticket específico (admin/vendedor)')
    .addStringOption(option =>
      option.setName('pedido')
        .setDescription('ID do pedido (ex: pedido-39)')
        .setRequired(true)),

  async execute(interaction) {
    // Verifica se o usuário tem permissão (admin ou vendedor)
    const { isAdmin } = require('../utils/permissions');
if (!await isAdmin(interaction.member)) {
  return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
}

    const pedidoId = interaction.options.getString('pedido');
    const channel = interaction.guild.channels.cache.find(c => c.name === pedidoId);

    if (!channel) {
      return interaction.reply({ content: `❌ Canal ${pedidoId} não encontrado.`, ephemeral: true });
    }

    await interaction.reply({ content: `🔒 Fechando ticket ${pedidoId}...`, ephemeral: true });
    await channel.delete();
    console.log(`🗑️ Canal ${pedidoId} deletado por ${interaction.user.tag}`);
  }
};
