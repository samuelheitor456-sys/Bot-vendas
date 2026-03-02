const db = require('../database/db');

module.exports = async (interaction, client) => {
  if (interaction.customId !== 'selecionar_canal') return;

  const canalId = interaction.values[0];

  db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, ['canal_vendas', canalId], (err) => {
    if (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Erro ao salvar configuração.', ephemeral: true });
    }
    interaction.reply({ content: `✅ Canal de vendas definido para <#${canalId}>.`, ephemeral: true });
  });
};
else if (interaction.customId === 'selecionar_produto_catalogo') {
  const produtoId = interaction.values[0];
  db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], async (err, produto) => {
    if (err || !produto) return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(produto.nome)
      .setDescription(produto.descricao)
      .setThumbnail(produto.imagem)
      .addFields(
        { name: '💰 Preço', value: `R$ ${produto.valor.toFixed(2)}`, inline: true },
        { name: '🆔 ID', value: produto.id.toString(), inline: true }
      )
      .setFooter({ text: 'Clique no botão para comprar' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`comprar_${produto.id}`)
        .setLabel('🛒 Comprar agora')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  });
}
