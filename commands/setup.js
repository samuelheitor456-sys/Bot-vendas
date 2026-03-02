const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configura o canal de comandos do bot (admin)'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🛍️ **Central de Comandos**')
      .setDescription(`
Bem-vindo à loja! Use os botões abaixo para navegar:

• **🛒 Catálogo**: Ver todos os produtos disponíveis.
• **🛍️ Meu Carrinho**: Ver itens adicionados e finalizar compra.
• **❓ Ajuda**: Explica como o sistema funciona.
      `)
      .setFooter({ text: 'Clique nos botões para interagir' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ver_catalogo')
        .setLabel('🛒 Catálogo')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ver_carrinho')
        .setLabel('🛍️ Meu Carrinho')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ajuda')
        .setLabel('❓ Ajuda')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Central de comandos criada!', ephemeral: true });
  }
};
