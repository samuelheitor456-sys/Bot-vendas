const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carrinho')
    .setDescription('Gerencia seu carrinho de compras')
    .addSubcommand(sub =>
      sub.setName('ver')
        .setDescription('Ver itens do carrinho'))
    .addSubcommand(sub =>
      sub.setName('adicionar')
        .setDescription('Adicionar produto ao carrinho')
        .addIntegerOption(opt => opt.setName('produto_id').setDescription('ID do produto').setRequired(true))
        .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remover')
        .setDescription('Remover item do carrinho')
        .addIntegerOption(opt => opt.setName('item_id').setDescription('ID do item').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('finalizar')
        .setDescription('Finalizar compra e gerar PIX')),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const usuarioId = interaction.user.id;

    if (subcommand === 'ver') {
      db.all(`SELECT ci.id, p.nome, p.valor, ci.quantidade FROM carrinho_itens ci
              JOIN carrinhos c ON ci.carrinho_id = c.id
              JOIN produtos p ON ci.produto_id = p.id
              WHERE c.usuario_id = ?`, [usuarioId], (err, itens) => {
        if (err) return interaction.reply({ content: '❌ Erro ao buscar carrinho.', ephemeral: true });
        if (itens.length === 0) return interaction.reply({ content: '🛒 Seu carrinho está vazio.', ephemeral: true });

        let total = 0;
        let desc = '';
        itens.forEach(item => {
          const subtotal = item.valor * item.quantidade;
          desc += `**${item.nome}** x${item.quantidade} = R$ ${subtotal.toFixed(2)} (ID: ${item.id})\n`;
          total += subtotal;
        });

        const embed = new EmbedBuilder()
          .setColor(0x00BFFF)
          .setTitle('🛒 Seu Carrinho')
          .setDescription(desc)
          .addFields({ name: 'Total', value: `R$ ${total.toFixed(2)}` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('carrinho_finalizar')
            .setLabel('Finalizar compra')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('carrinho_limpar')
            .setLabel('Limpar carrinho')
            .setStyle(ButtonStyle.Danger)
        );

        interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      });
    }

    else if (subcommand === 'adicionar') {
      const produtoId = interaction.options.getInteger('produto_id');
      const quantidade = interaction.options.getInteger('quantidade') || 1;

      db.get(`SELECT id, nome, valor FROM produtos WHERE id = ?`, [produtoId], (err, produto) => {
        if (err || !produto) return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });

        db.run(`INSERT INTO carrinhos (usuario_id) VALUES (?) ON CONFLICT(usuario_id) DO NOTHING`, [usuarioId]);
        db.get(`SELECT id FROM carrinhos WHERE usuario_id = ?`, [usuarioId], (err2, carrinho) => {
          if (err2 || !carrinho) return interaction.reply({ content: '❌ Erro ao criar carrinho.', ephemeral: true });
          db.run(`INSERT INTO carrinho_itens (carrinho_id, produto_id, quantidade) VALUES (?, ?, ?)`,
            [carrinho.id, produtoId, quantidade], function(err3) {
              if (err3) return interaction.reply({ content: '❌ Erro ao adicionar item.', ephemeral: true });
              interaction.reply({ content: `✅ ${produto.nome} x${quantidade} adicionado ao carrinho.`, ephemeral: true });
            });
        });
      });
    }

    else if (subcommand === 'remover') {
      const itemId = interaction.options.getInteger('item_id');
      db.run(`DELETE FROM carrinho_itens WHERE id = ?`, [itemId], function(err) {
        if (err) return interaction.reply({ content: '❌ Erro ao remover item.', ephemeral: true });
        interaction.reply({ content: `✅ Item removido do carrinho.`, ephemeral: true });
      });
    }

    else if (subcommand === 'finalizar') {
      // Reaproveita a lógica de finalizar carrinho (vem depois)
      await finalizarCarrinho(interaction, client, usuarioId);
    }
  }
};

async function finalizarCarrinho(interaction, client, usuarioId) {
  // Busca itens do carrinho e calcula total
  db.all(`SELECT ci.id, p.id as produto_id, p.nome, p.valor, ci.quantidade FROM carrinho_itens ci
          JOIN carrinhos c ON ci.carrinho_id = c.id
          JOIN produtos p ON ci.produto_id = p.id
          WHERE c.usuario_id = ?`, [usuarioId], async (err, itens) => {
    if (err || itens.length === 0) return interaction.reply({ content: '❌ Carrinho vazio.', ephemeral: true });

    let total = itens.reduce((acc, i) => acc + i.valor * i.quantidade, 0);

    // Gerar PIX com o total (reutiliza gerarPix, mas adaptado para múltiplos produtos)
    // Para simplificar, aqui criamos um pedido único com valor total
    const pedidoId = `carrinho-${Date.now()}`;
    db.run(`INSERT INTO pedidos (pedido_id, comprador_id, valor, status) VALUES (?, ?, ?, ?)`,
      [pedidoId, usuarioId, total, 'aguardando_pagamento'], async function(err2) {
        if (err2) return interaction.reply({ content: '❌ Erro ao gerar pedido.', ephemeral: true });

        // Chamar gerarPix (precisa adaptar para aceitar valor total)
        const gerarPix = require('../utils/gerarPix');
        try {
          const { embed, attachment } = await gerarPix({ pedido_id: pedidoId, valor: total }, interaction.user.id);
          await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
          // Limpa carrinho após finalizar
          db.run(`DELETE FROM carrinho_itens WHERE carrinho_id = (SELECT id FROM carrinhos WHERE usuario_id = ?)`, [usuarioId]);
        } catch (error) {
          interaction.reply({ content: '❌ Erro ao gerar PIX.', ephemeral: true });
        }
      });
  });
                }
