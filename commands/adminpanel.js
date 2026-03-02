const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fixaradmin')
    .setDescription('Fixa o painel administrativo no canal atual (admin)'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🛠️ **Painel Administrativo Fixo**')
      .setDescription(`
Utilize os botões abaixo para gerenciar a loja:

• **📢 Definir canal de vendas**: Escolha onde os produtos serão publicados.
• **➕ Adicionar produto**: Publica um novo produto (primeiro escolha o canal).
• **📋 Listar produtos**: Mostra todos os produtos cadastrados.
• **🎁 Adicionar cargo**: Vincula um cargo a um produto (para compradores).
• **📦 Adicionar estoque**: Ajusta a quantidade disponível de um produto.
• **💾 Backup**: Gera um backup do banco de dados.
      `)
      .setFooter({ text: 'Apenas administradores podem usar estes botões.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_definir_canal')
        .setLabel('📢 Definir canal')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_adicionar_produto')
        .setLabel('➕ Adicionar produto')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_listar_produtos')
        .setLabel('📋 Listar produtos')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_adicionar_cargo')
        .setLabel('🎁 Adicionar cargo')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_adicionar_estoque')
        .setLabel('📦 Adicionar estoque')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_backup')
        .setLabel('💾 Backup')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
    await interaction.reply({ content: '✅ Painel fixado no canal!', ephemeral: true });
  }
};
