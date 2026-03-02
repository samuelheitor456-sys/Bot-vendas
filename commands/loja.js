const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Exibe o catálogo de produtos disponíveis'),

  async execute(interaction) {
    db.all(`SELECT id, nome, valor FROM produtos ORDER BY id DESC`, (err, rows) => {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao carregar produtos.', ephemeral: true });
      }
      if (rows.length === 0) {
        return interaction.reply({ content: '📭 Nenhum produto disponível no momento.', ephemeral: true });
      }

      const options = rows.map(p => ({
        label: p.nome,
        description: `R$ ${p.valor.toFixed(2)}`,
        value: p.id.toString()
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('selecionar_produto_catalogo')
        .setPlaceholder('Escolha um produto')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      interaction.reply({ content: '🛍️ **Catálogo de Produtos**', components: [row], ephemeral: true });
    });
  }
};
