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
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID) && 
        !interaction.member.roles.cache.has(process.env.VENDEDOR_ROLE_ID)) {
      return interaction.reply({ content: '❌ Você não tem permissão para fechar tickets.', ephemeral: true });
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
