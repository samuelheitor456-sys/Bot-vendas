const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relatorio')
    .setDescription('Exibe relatório de vendas (admin)')
    .addStringOption(option =>
      option.setName('periodo')
        .setDescription('Período (hoje, semana, mes, total)')
        .setRequired(false)
        .addChoices(
          { name: 'Hoje', value: 'today' },
          { name: 'Esta semana', value: 'week' },
          { name: 'Este mês', value: 'month' },
          { name: 'Total', value: 'all' }
        )),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const periodo = interaction.options.getString('periodo') || 'all';
    let whereClause = '';

    if (periodo === 'today') whereClause = "WHERE date(concluido_em) = date('now')";
    else if (periodo === 'week') whereClause = "WHERE concluido_em >= datetime('now', '-7 days')";
    else if (periodo === 'month') whereClause = "WHERE concluido_em >= datetime('now', '-30 days')";

    db.all(`SELECT * FROM pedidos WHERE status = 'concluido' ${whereClause}`, (err, pedidos) => {
      if (err) return interaction.reply({ content: '❌ Erro no banco.', ephemeral: true });

      const totalVendas = pedidos.length;
      const totalReceita = pedidos.reduce((acc, p) => acc + p.valor, 0);
      const produtosMap = {};
      pedidos.forEach(p => produtosMap[p.produto_id] = (produtosMap[p.produto_id] || 0) + 1);
      const produtoMaisVendido = Object.keys(produtosMap).length ? Object.keys(produtosMap).reduce((a, b) => produtosMap[a] > produtosMap[b] ? a : b) : 'N/A';

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📊 Relatório de Vendas')
        .addFields(
          { name: '📦 Total de vendas', value: totalVendas.toString(), inline: true },
          { name: '💰 Receita total', value: `R$ ${totalReceita.toFixed(2)}`, inline: true },
          { name: '🏆 Produto mais vendido', value: `ID ${produtoMaisVendido} (${produtosMap[produtoMaisVendido] || 0} vendas)`, inline: false }
        )
        .setFooter({ text: `Período: ${periodo}` })
        .setTimestamp();

      interaction.reply({ embeds: [embed], ephemeral: true });
    });
  }
};
