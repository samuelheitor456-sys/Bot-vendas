const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clientes')
    .setDescription('Lista todos os clientes que já compraram (IDs)'),

  async execute(interaction, client, db) {
    const { isAdmin } = require('../utils/permissions');
if (!await isAdmin(interaction.member)) {
  return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
}

    db.all(`SELECT comprador_id, COUNT(*) as total, GROUP_CONCAT(pedido_id) as pedidos 
            FROM pedidos WHERE status = 'concluido' 
            GROUP BY comprador_id ORDER BY total DESC`, (err, rows) => {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao buscar clientes.', ephemeral: true });
      }

      if (rows.length === 0) {
        return interaction.reply({ content: '📭 Nenhum cliente encontrado.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('👥 Lista de Clientes')
        .setDescription(`Total de clientes: **${rows.length}**`)
        .setTimestamp();

      rows.forEach(row => {
        embed.addFields({
          name: `<@${row.comprador_id}>`,
          value: `**Compras:** ${row.total}\n**Último pedido:** ${row.pedidos.split(',')[0]}`,
          inline: false
        });
      });

      interaction.reply({ embeds: [embed], ephemeral: true });
    });
  }
};
