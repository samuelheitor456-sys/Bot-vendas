const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');

module.exports = async (interaction, client) => {
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

        const estoqueDisplay = produto.estoque === -1 ? 'Ilimitado' : produto.estoque + ' unidades';
        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle('🛡️ Compra Segura')
          .setDescription(`**${produto.nome}**\n${produto.descricao}`)
          .addFields(
            { name: 'Valor', value: `R$ ${produto.valor.toFixed(2)}`, inline: true },
            { name: 'Estoque', value: estoqueDisplay, inline: true },
            { name: 'Entrega', value: 'Automática', inline: true }
          )
          .setImage(produto.imagem)
          .setFooter({ text: 'BOT DE VENDAS PRIME WOLF PACK' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`add_carrinho_${produto.id}`)
            .setLabel('Adicionar ao carrinho')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕'),
          new ButtonBuilder()
            .setCustomId(`comprar_agora_${produto.id}`)
            .setLabel('Comprar agora')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛒')
        );

        await interaction.update({ embeds: [embed], components: [row] });
      });
    }

    else if (interaction.customId === 'selecionar_canal_para_produto') {
      const canalId = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`modal_produto_canal_${canalId}`)
        .setTitle('➕ Novo Produto');

      const nomeInput = new TextInputBuilder().setCustomId('nome').setLabel('📦 Nome').setStyle(TextInputStyle.Short).setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('descricao').setLabel('📝 Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true);
      const valorInput = new TextInputBuilder().setCustomId('valor').setLabel('💰 Valor (ex: 49.90)').setStyle(TextInputStyle.Short).setRequired(true);
      const linkInput = new TextInputBuilder().setCustomId('link').setLabel('🔗 Link de entrega').setStyle(TextInputStyle.Short).setRequired(true);
      const imagemInput = new TextInputBuilder().setCustomId('imagem').setLabel('🖼️ URL da imagem').setStyle(TextInputStyle.Short).setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(valorInput),
        new ActionRowBuilder().addComponents(linkInput),
        new ActionRowBuilder().addComponents(imagemInput)
      );
      await interaction.showModal(modal);
    }

    else if (interaction.customId === 'selecionar_produto_cargo') {
      const produtoId = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`modal_cargo_${produtoId}`)
        .setTitle('Adicionar Cargo ao Produto');
      const cargoInput = new TextInputBuilder()
        .setCustomId('cargo_id')
        .setLabel('ID do cargo (ex: 123456789)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const row = new ActionRowBuilder().addComponents(cargoInput);
      modal.addComponents(row);
      await interaction.showModal(modal);
    }

    else if (interaction.customId === 'selecionar_produto_estoque') {
      const produtoId = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`modal_estoque_${produtoId}`)
        .setTitle('Ajustar Estoque');
      const estoqueInput = new TextInputBuilder()
        .setCustomId('estoque')
        .setLabel('Nova quantidade (-1 ilimitado)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const row = new ActionRowBuilder().addComponents(estoqueInput);
      modal.addComponents(row);
      await interaction.showModal(modal);
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
