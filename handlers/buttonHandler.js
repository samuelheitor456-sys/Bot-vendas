const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

// Função auxiliar para criar ticket
async function criarTicket(interaction, produtoId, client) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Busca próximo número de pedido
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

  // Busca produto
  const produto = await new Promise((resolve, reject) => {
    db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!produto) throw new Error('Produto não encontrado.');

  const vendedorRole = process.env.VENDEDOR_ROLE_ID;
  if (!vendedorRole) throw new Error('VENDEDOR_ROLE_ID não configurado.');

  if (!guild.members.me.permissions.has('ManageChannels')) {
    throw new Error('Bot não tem permissão "Gerenciar Canais".');
  }

  // Cria canal
  const ticketChannel = await guild.channels.create({
    name: pedidoId,
    type: 0,
    permissionOverwrites: [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: vendedorRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      { id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
    ],
  });

  // Insere pedido no banco
  await new Promise((resolve, reject) => {
    db.run(`INSERT INTO pedidos (pedido_id, pedido_numero, produto_id, comprador_id, valor, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [pedidoId, pedidoNumero, produtoId, user.id, produto.valor, 'aguardando_pagamento'],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  await interaction.reply({ content: `✅ **Ticket criado:** ${ticketChannel}`, ephemeral: true });

  // Mensagem inicial com botões
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
**🛒 NOVO PEDIDO** • <@&${vendedorRole}>
━━━━━━━━━━━━━━━━━━━━━━━━

**👤 Cliente:** ${user}
**🛍️ Produto:** **${produto.nome}**
**💰 Valor:** **R$ ${produto.valor}**

📌 Digite \`/email seu@email.com\` para gerar o PIX.
━━━━━━━━━━━━━━━━━━━━━━━━
`;

  await ticketChannel.send({ content: mensagem, components: [row] });
}

// Função para finalizar carrinho (usada no botão)
async function finalizarCarrinho(interaction, client, usuarioId) {
  const db = require('../database/db');
  const gerarPix = require('../utils/gerarPix');

  db.all(`SELECT ci.id, p.id as produto_id, p.nome, p.valor, ci.quantidade FROM carrinho_itens ci
          JOIN carrinhos c ON ci.carrinho_id = c.id
          JOIN produtos p ON ci.produto_id = p.id
          WHERE c.usuario_id = ?`, [usuarioId], async (err, itens) => {
    if (err || itens.length === 0) {
      return interaction.reply({ content: '❌ Carrinho vazio.', ephemeral: true });
    }

    let total = itens.reduce((acc, i) => acc + i.valor * i.quantidade, 0);
    const pedidoId = `carrinho-${Date.now()}`;

    db.run(`INSERT INTO pedidos (pedido_id, comprador_id, valor, status) VALUES (?, ?, ?, ?)`,
      [pedidoId, usuarioId, total, 'aguardando_pagamento'], async function(err2) {
        if (err2) {
          console.error(err2);
          return interaction.reply({ content: '❌ Erro ao gerar pedido.', ephemeral: true });
        }

        try {
          const { embed, attachment } = await gerarPix({ pedido_id: pedidoId, valor: total }, interaction.user.id);
          await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
          // Limpa carrinho após finalizar
          db.run(`DELETE FROM carrinho_itens WHERE carrinho_id = (SELECT id FROM carrinhos WHERE usuario_id = ?)`, [usuarioId]);
        } catch (error) {
          console.error(error);
          interaction.reply({ content: '❌ Erro ao gerar PIX.', ephemeral: true });
        }
      });
  });
}

module.exports = async (interaction, client) => {
  const customId = interaction.customId;

  try {
    if (customId === 'definir_canal') {
      const channels = interaction.guild.channels.cache
        .filter(c => c.type === 0)
        .map(c => ({ label: c.name, value: c.id }))
        .slice(0, 25);
      if (channels.length === 0) return interaction.reply({ content: '❌ Nenhum canal de texto.', ephemeral: true });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('selecionar_canal')
        .setPlaceholder('Escolha o canal de vendas')
        .addOptions(channels);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: '📍 Selecione o canal:', components: [row], ephemeral: true });
    }

    else if (customId === 'adicionar_produto') {
      const modal = new ModalBuilder()
        .setCustomId('modal_produto')
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

    else if (customId.startsWith('comprar_')) {
      const produtoId = customId.split('_')[1];
      await criarTicket(interaction, produtoId, client);
    }

    else if (customId.startsWith('confirmar_')) {
      if (!interaction.member.roles.cache.has(process.env.VENDEDOR_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas vendedores.', ephemeral: true });
      }
      const pedidoId = customId.split('_')[1];
      const channel = interaction.channel;

      // Busca produto associado ao pedido para obter cargo_id
      db.get(`SELECT produto_id FROM pedidos WHERE pedido_id = ?`, [pedidoId], (err, row) => {
        if (!err && row) {
          db.get(`SELECT cargo_id FROM produtos WHERE id = ?`, [row.produto_id], (err2, produto) => {
            if (!err2 && produto && produto.cargo_id) {
              const member = channel.guild.members.cache.get(interaction.user.id);
              if (member) {
                member.roles.add(produto.cargo_id).catch(console.error);
              }
            }
          });
        }
      });

      await interaction.reply({ content: '✅ Venda confirmada! Fechando em 5s...' });
      db.run(`UPDATE pedidos SET status = 'concluido' WHERE pedido_id = ?`, [pedidoId]);
      setTimeout(async () => await channel.delete(), 5000);
    }

    else if (customId.startsWith('fechar_')) {
      if (!interaction.member.roles.cache.has(process.env.VENDEDOR_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas vendedores.', ephemeral: true });
      }
      const pedidoId = customId.split('_')[1];
      const channel = interaction.channel;
      await interaction.reply({ content: '🔒 Fechando ticket...' });
      setTimeout(async () => await channel.delete(), 5000);
    }

    else if (customId.startsWith('copiar_')) {
      const pedidoId = customId.replace('copiar_', '');
      db.get(`SELECT qr_code FROM pedidos WHERE pedido_id = ?`, [pedidoId], async (err, row) => {
        if (err || !row || !row.qr_code) {
          return interaction.reply({ content: '❌ Chave PIX não encontrada.', ephemeral: true });
        }
        await interaction.reply({
          content: `🔑 **Chave PIX (copia e cola):**\n\`${row.qr_code}\``,
          ephemeral: true
        });
      });
    }

    else if (customId === 'carrinho_finalizar') {
      const usuarioId = interaction.user.id;
      await finalizarCarrinho(interaction, client, usuarioId);
    }

    else if (customId === 'carrinho_limpar') {
      db.run(`DELETE FROM carrinho_itens WHERE carrinho_id = (SELECT id FROM carrinhos WHERE usuario_id = ?)`, [interaction.user.id]);
      interaction.reply({ content: '✅ Carrinho limpo.', ephemeral: true });
    }
  } catch (error) {
    console.error('❌ Erro no buttonHandler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ Erro: ${error.message}`, ephemeral: true });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: `❌ Erro: ${error.message}` });
    }
  }
};
