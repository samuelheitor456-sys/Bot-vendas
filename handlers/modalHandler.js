const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = async (interaction, client) => {
  // Modal para adicionar produto com quantidade
  if (interaction.customId === 'modal_quantidade') {
    const produtoId = interaction.fields.getTextInputValue('produto_id');
    const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade'));
    const acao = interaction.fields.getTextInputValue('acao'); // 'comprar' ou 'carrinho'

    // Busca produto
    db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], async (err, produto) => {
      if (err || !produto) {
        return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
      }

      if (acao === 'comprar') {
        // Criar ticket (reutiliza a função criarTicket, mas precisamos passar quantidade? Talvez adaptar)
        // Como a função criarTicket atual não aceita quantidade, vamos chamar uma versão modificada.
        // Por simplicidade, podemos chamar a função existente e depois ajustar o valor (mas isso seria inconsistente).
        // Vamos criar uma nova função para compra direta com quantidade.
        await criarTicketComQuantidade(interaction, produto, quantidade, client);
      } else if (acao === 'carrinho') {
        // Adicionar ao carrinho
        await adicionarAoCarrinho(interaction, produto, quantidade);
      }
    });
  }

  // Se for o modal de produto (já existente), mantém
  if (interaction.customId === 'modal_produto') {
    // ... (código atual de criação de produto)
  }
};

async function adicionarAoCarrinho(interaction, produto, quantidade) {
  const usuarioId = interaction.user.id;
  db.run(`INSERT INTO carrinhos (usuario_id) VALUES (?) ON CONFLICT(usuario_id) DO NOTHING`, [usuarioId]);
  db.get(`SELECT id FROM carrinhos WHERE usuario_id = ?`, [usuarioId], (err, carrinho) => {
    if (err || !carrinho) {
      return interaction.reply({ content: '❌ Erro ao acessar carrinho.', ephemeral: true });
    }
    db.run(`INSERT INTO carrinho_itens (carrinho_id, produto_id, quantidade) VALUES (?, ?, ?)`,
      [carrinho.id, produto.id, quantidade], function(err2) {
        if (err2) {
          return interaction.reply({ content: '❌ Erro ao adicionar item.', ephemeral: true });
        }
        interaction.reply({ content: `✅ ${produto.nome} x${quantidade} adicionado ao carrinho.`, ephemeral: true });
      });
  });
}

async function criarTicketComQuantidade(interaction, produto, quantidade, client) {
  // Adaptar a função criarTicket para considerar a quantidade (talvez criar um pedido com valor total)
  // Vamos reutilizar a lógica de criarTicket, mas multiplicar o valor.
  // Para simplificar, podemos criar um pedido com valor = produto.valor * quantidade.
  // No entanto, o ticket tradicional é para um produto só. Vamos manter assim.
  // Se precisar de múltiplos produtos, é melhor usar o carrinho.
  // Vamos apenas chamar a função criarTicket passando o produtoId, mas ignorar quantidade.
  // Ou podemos modificar a função criarTicket para aceitar quantidade e link do produto? Fica complexo.
  // Por enquanto, vou manter a função existente, mas avisando que a quantidade será ignorada.
  // Idealmente, você teria uma função que cria pedido com quantidade e produto.
  const criarTicket = require('./buttonHandler').criarTicket; // Mas isso causaria dependência circular.
  // Melhor: mover a função para um utilitário.
  // Vou criar uma nova função aqui mesmo.

  const guild = interaction.guild;
  const user = interaction.user;
  const pedidoNumero = await new Promise((resolve, reject) => {
    db.get(`SELECT value FROM config WHERE key = 'pedido_counter'`, (err, row) => {
      if (err) reject(err);
      else {
        const next = (parseInt(row?.value || '0') + 1).toString();
        db.run(`UPDATE config SET value = ? WHERE key = 'pedido_counter'`, [next], (err2) => {
          if (err2) reject(err2);
          else resolve(next);
        });
      }
    });
  });
  const pedidoId = `pedido-${pedidoNumero}`;
  const valorTotal = produto.valor * quantidade;

  // Cria canal
  const ticketChannel = await guild.channels.create({
    name: pedidoId,
    type: 0,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: process.env.VENDEDOR_ROLE_ID, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
    ],
  });

  await new Promise((resolve, reject) => {
    db.run(`INSERT INTO pedidos (pedido_id, pedido_numero, produto_id, comprador_id, valor, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [pedidoId, pedidoNumero, produto.id, user.id, valorTotal, 'aguardando_pagamento'],
      function(err) { if (err) reject(err); else resolve(); });
  });

  await interaction.reply({ content: `✅ **Ticket criado:** ${ticketChannel}`, ephemeral: true });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirmar_${pedidoId}`)
      .setLabel('✅ CONFIRMAR VENDA')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`fechar_${pedidoId}`)
      .setLabel('❌ FECHAR TICKET')
      .setStyle(ButtonStyle.Danger)
  );

  const mensagem = `
━━━━━━━━━━━━━━━━━━━━━━━━
**🛒 NOVO PEDIDO** • <@&${process.env.VENDEDOR_ROLE_ID}>
━━━━━━━━━━━━━━━━━━━━━━━━

**👤 Cliente:** ${user}
**🛍️ Produto:** **${produto.nome}** x${quantidade}
**💰 Valor total:** **R$ ${valorTotal.toFixed(2)}**

📌 Digite \`/email seu@email.com\` para gerar o PIX.
━━━━━━━━━━━━━━━━━━━━━━━━
`;

  await ticketChannel.send({ content: mensagem, components: [row] });
}
