const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editarestoque')
    .setDescription('Altera o estoque de um produto (admin)')
    .addIntegerOption(option =>
      option.setName('produto_id')
        .setDescription('ID do produto')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('quantidade')
        .setDescription('Nova quantidade (-1 para ilimitado)')
        .setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const produtoId = interaction.options.getInteger('produto_id');
    const quantidade = interaction.options.getInteger('quantidade');

    db.run(`UPDATE produtos SET estoque = ? WHERE id = ?`, [quantidade, produtoId], function(err) {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao atualizar estoque.', ephemeral: true });
      }
      if (this.changes === 0) {
        return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
      }
      interaction.reply({ content: `✅ Estoque do produto ID ${produtoId} atualizado para ${quantidade === -1 ? 'ilimitado' : quantidade}.`, ephemeral: true });
    });
  }
};
