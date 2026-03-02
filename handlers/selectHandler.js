const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = async (interaction, client) => {
  if (interaction.customId !== 'selecionar_canal' && interaction.customId !== 'selecionar_produto_catalogo') return;

  try {
    if (interaction.customId === 'selecionar_canal') {
      const canalId = interaction.values[0];
      db.run(`INSERT OR REPLACE INTO config (key, value) VALUES ('canal_vendas', ?)`, [canalId], (err) => {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao salvar configuração.', ephemeral: true });
        }
        interaction.reply({ content: `✅ Canal de vendas definido para <#${canalId}>.`, ephemeral: true });
      });
    }

    else if (interaction.customId === 'selecionar_produto_catalogo') {
      const produtoId = interaction.values[0];
      db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], async (err, produto) => {
        if (err || !produto) {
          return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setAuthor({ name: '🛍️ Produto' })
          .setTitle(produto.nome)
          .setDescription(`\`\`\`\n${produto.descricao}\n\`\`\``)
          .setThumbnail(produto.imagem)
          .addFields(
            { name: '💰 Preço', value: `R$ ${produto.valor.toFixed(2)}`, inline: true },
            { name: '🆔 ID', value: produto.id.toString(), inline: true },
            { name: '🎁 Cargo', value: produto.cargo_id ? `<@&${produto.cargo_id}>` : 'Nenhum', inline: true }
          )
          .setFooter({ text: 'Clique no botão para comprar' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`comprar_${produto.id}`)
            .setLabel('🛒 Comprar agora')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛒')
        );

        await interaction.update({ embeds: [embed], components: [row] });
      });
    }
  } catch (error) {
    console.error('❌ Erro no selectHandler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Erro ao processar seleção.', ephemeral: true });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: '❌ Erro ao processar seleção.' });
    }
  }
};
