const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = async (interaction, client) => {
  if (interaction.customId !== 'modal_produto') return;

  const nome = interaction.fields.getTextInputValue('nome');
  const descricao = interaction.fields.getTextInputValue('descricao');
  const valor = parseFloat(interaction.fields.getTextInputValue('valor'));
  const link = interaction.fields.getTextInputValue('link');
  const imagem = interaction.fields.getTextInputValue('imagem');

  if (!imagem.startsWith('http')) {
    return interaction.reply({ content: '❌ URL da imagem deve começar com http:// ou https://', ephemeral: true });
  }

  const canalId = await new Promise((resolve) => {
    db.get(`SELECT value FROM config WHERE key = 'canal_vendas'`, (err, row) => {
      resolve(row?.value || null);
    });
  });

  if (!canalId) {
    return interaction.reply({ content: '❌ Configure o canal de vendas primeiro.', ephemeral: true });
  }

  const canal = client.channels.cache.get(canalId);
  if (!canal) {
    return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
  }

  db.run(`INSERT INTO produtos (nome, descricao, valor, link, imagem, canal_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, descricao, valor, link, imagem, canalId], function(err) {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao salvar.', ephemeral: true });
      }

      const produtoId = this.lastID;

      // 🎨 EMBED PROFISSIONAL
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: '🛍️ NOVO PRODUTO' })
        .setTitle(`**${nome}**`)
        .setDescription(`\`\`\`\n${descricao}\n\`\`\``)
        .setThumbnail(imagem)
        .addFields(
          { name: '💰 **Preço**', value: `**R$ ${valor.toFixed(2)}**`, inline: true },
          { name: '📦 **Estoque**', value: '✅ Ilimitado', inline: true }
        )
        .setFooter({ text: `ID: ${produtoId} • Pagamento via PIX • Entrega automática` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`comprar_${produtoId}`)
          .setLabel('🛒 Adicionar ao carrinho')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛒')
      );

      canal.send({ embeds: [embed], components: [row] });

      interaction.reply({ content: '✅ Produto publicado com sucesso!', ephemeral: true });
    });
};
