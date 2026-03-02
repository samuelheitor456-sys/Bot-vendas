const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel de administração de produtos'),

  async execute(interaction, client, db) {
    const adminRole = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({ content: '❌ Você não tem permissão.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('definir_canal')
        .setLabel('📢 Definir canal de vendas')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('adicionar_produto')
        .setLabel('➕ Adicionar produto')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      content: '**🛠️ Painel de Administração**\nEscolha uma opção abaixo:',
      components: [row],
      ephemeral: true
    });
  }
};
