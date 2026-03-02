const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminpanel')
    .setDescription('Cria um painel administrativo fixo no canal (admin)'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🛠️ **Painel Administrativo**')
      .setDescription(`
Utilize os botões abaixo para gerenciar a loja:

• **📢 Definir canal de vendas**: Escolha onde os produtos serão publicados.
• **➕ Adicionar produto**: Abre um formulário para criar um novo produto.
• **📋 Listar produtos**: Mostra todos os produtos cadastrados.
• **💾 Backup**: Gera um backup do banco de dados.
      `)
      .setFooter({ text: 'Apenas administradores podem usar estes botões.' });

    const row = new ActionRowBuilder().addComponents(
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
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_backup')
        .setLabel('💾 Backup')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Painel administrativo criado!', ephemeral: true });
  }
};
