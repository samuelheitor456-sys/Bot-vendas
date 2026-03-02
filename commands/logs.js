const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Mostra o histórico de vendas concluídas'),

  async execute(interaction, client, db) {
    const adminRole = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
    }

    db.all(`SELECT * FROM pedidos WHERE status = 'concluido' ORDER BY concluido_em DESC LIMIT 20`, (err, rows) => {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao buscar logs.', ephemeral: true });
      }

      if (rows.length === 0) {
        return interaction.reply({ content: '📭 Nenhuma venda concluída ainda.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Últimas vendas')
        .setColor(0x00FF00)
        .setTimestamp();

      rows.forEach(row => {
        embed.addFields({
          name: `Pedido #${row.pedido_id}`,
          value: `Comprador: <@${row.comprador_id}>\nProduto ID: ${row.produto_id}\nValor: R$ ${row.valor}\nData: ${row.concluido_em}`,
          inline: false
        });
      });

      interaction.reply({ embeds: [embed], ephemeral: true });
    });
  }
};
