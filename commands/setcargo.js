const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcargo')
    .setDescription('Define um cargo que será dado ao comprador de um produto')
    .addIntegerOption(option =>
      option.setName('produto_id')
        .setDescription('ID do produto')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('cargo')
        .setDescription('Cargo a ser atribuído')
        .setRequired(true)),

  async execute(interaction, client) {
    const adminRole = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
    }

    const produtoId = interaction.options.getInteger('produto_id');
    const cargo = interaction.options.getRole('cargo');

    db.run(`UPDATE produtos SET cargo_id = ? WHERE id = ?`, [cargo.id, produtoId], function(err) {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao vincular cargo.', ephemeral: true });
      }
      if (this.changes === 0) {
        return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
      }
      interaction.reply({ content: `✅ Cargo ${cargo} vinculado ao produto ID ${produtoId}.`, ephemeral: true });
    });
  }
};
