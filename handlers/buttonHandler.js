const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// ==================== FUNÇÕES AUXILIARES ====================

async function mostrarCatalogo(interaction) {
  db.all(`SELECT id, nome, valor, imagem FROM produtos ORDER BY id DESC`, (err, rows) => {
    if (err || rows.length === 0) {
      return interaction.reply({ content: '📭 Nenhum produto disponível.', ephemeral: true });
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

async function mostrarCarrinho(interaction) {
  const usuarioId = interaction.user.id;
  db.all(`SELECT ci.id, p.id as produto_id, p.nome, p.valor, ci.quantidade, p.imagem, p.link 
          FROM carrinho_itens ci
          JOIN carrinhos c ON ci.carrinho_id = c.id
          JOIN produtos p ON ci.produto_id = p.id
          WHERE c.usuario_id = ?`, [usuarioId], async (err, itens) => {
    if (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Erro ao buscar carrinho.', ephemeral: true });
    }
    if (itens.length === 0) {
      return interaction.reply({ content: '🛒 Seu carrinho está vazio.', ephemeral: true });
    }

    let total = 0;
    let desc = '';
    const rows = [];

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const subtotal = item.valor * item.quantidade;
      total += subtotal;
      desc += `**${item.nome}** x${item.quantidade} - R$ ${subtotal.toFixed(2)}\n`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`remover_item_${item.id}`)
          .setLabel(`Remover ${item.nome}`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
      rows.push(row);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('🛒 Seu Carrinho')
      .setDescription(desc)
      .addFields({ name: '💰 Total', value: `R$ ${total.toFixed(2)}` })
      .setFooter({ text: 'Revise seus itens e finalize a compra.' })
      .setTimestamp();

    const finalizarRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('finalizar_compra')
        .setLabel('✅ Finalizar Compra')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💳')
    );

    await interaction.reply({ embeds: [embed], components: [...rows, finalizarRow], ephemeral: true });
  });
}

async function finalizarCompra(interaction, client) {
  const usuarioId = interaction.user.id;
  const guild = interaction.guild;
  const user = interaction.user;
  const vendedorRole = process.env.VENDEDOR_ROLE_ID;

  if (!vendedorRole) {
    return interaction.editReply({ content: '❌ VENDEDOR_ROLE_ID não configurado.', ephemeral: true });
  }

  const itens = await new Promise((resolve, reject) => {
    db.all(`SELECT ci.id, p.id as produto_id, p.nome, p.valor, ci.quantidade, p.link 
            FROM carrinho_itens ci
            JOIN carrinhos c ON ci.carrinho_id = c.id
            JOIN produtos p ON ci.produto_id = p.id
            WHERE c.usuario_id = ?`, [usuarioId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  if (itens.length === 0) {
    return interaction.editReply({ content: '❌ Carrinho vazio.', ephemeral: true });
  }

  const total = itens.reduce((acc, i) => acc + i.valor * i.quantidade, 0);

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

  await new Promise((resolve, reject) => {
    db.run(`INSERT INTO pedidos (pedido_id, pedido_numero, comprador_id, valor, status) VALUES (?, ?, ?, ?, ?)`,
      [pedidoId, pedidoNumero, user.id, total, 'aguardando_pagamento'],
      function(err) { if (err) reject(err); else resolve(); });
  });

  for (const item of itens) {
    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, valor_unitario) VALUES (?, ?, ?, ?)`,
        [pedidoId, item.produto_id, item.quantidade, item.valor], function(err) { if (err) reject(err); else resolve(); });
    });
  }

  await new Promise((resolve, reject) => {
    db.run(`DELETE FROM carrinho_itens WHERE carrinho_id = (SELECT id FROM carrinhos WHERE usuario_id = ?)`, [usuarioId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

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

  let descItens = itens.map(i => `**${i.nome}** x${i.quantidade} - R$ ${(i.valor * i.quantidade).toFixed(2)}`).join('\n');
  const mensagem = `
━━━━━━━━━━━━━━━━━━━━━━━━
**🛒 NOVO PEDIDO (CARRINHO)** • <@&${vendedorRole}>
━━━━━━━━━━━━━━━━━━━━━━━━

**👤 Cliente:** ${user}
**📦 Itens:**
${descItens}

**💰 Valor total:** **R$ ${total.toFixed(2)}**

📌 Digite \`/email seu@email.com\` para gerar o PIX.
━━━━━━━━━━━━━━━━━━━━━━━━
  `;

  await ticketChannel.send({ content: mensagem, components: [row] });
  await interaction.editReply({ content: `✅ **Ticket criado:** ${ticketChannel}`, ephemeral: true });
}

async function abrirModalQuantidade(interaction, produtoId, acao) {
  const modal = new ModalBuilder()
    .setCustomId('modal_quantidade')
    .setTitle('Quantidade');

  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade')
    .setLabel('Quantidade desejada')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex: 2');

  const produtoIdInput = new TextInputBuilder()
    .setCustomId('produto_id')
    .setLabel('Produto ID (não altere)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(produtoId.toString());

  const acaoInput = new TextInputBuilder()
    .setCustomId('acao')
    .setLabel('Ação (não altere)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(acao);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidadeInput),
    new ActionRowBuilder().addComponents(produtoIdInput),
    new ActionRowBuilder().addComponents(acaoInput)
  );

  await interaction.showModal(modal);
}

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

// ==================== HANDLER PRINCIPAL ====================

module.exports = async (interaction, client) => {
  const customId = interaction.customId;

  try {
    if (customId === 'admin_definir_canal') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }
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

    else if (customId === 'admin_adicionar_produto') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }
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

    else if (customId === 'admin_listar_produtos') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }
      db.all(`SELECT id, nome, valor FROM produtos ORDER BY id`, (err, rows) => {
        if (err || rows.length === 0) {
          return interaction.reply({ content: '📭 Nenhum produto cadastrado.', ephemeral: true });
        }
        let desc = rows.map(p => `**${p.id}.** ${p.nome} - R$ ${p.valor.toFixed(2)}`).join('\n');
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('📋 Produtos cadastrados')
          .setDescription(desc)
          .setFooter({ text: `Total: ${rows.length} produtos` });
        interaction.reply({ embeds: [embed], ephemeral: true });
      });
    }

    else if (customId === 'admin_backup') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }
      const backupCmd = require('../commands/backup.js');
      backupCmd.execute(interaction, client);
    }

    // ========== BOTÕES DE CREDENCIAL ==========
    else if (customId === 'cadastrar_credencial') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }

      db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, result) => {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao verificar credencial.', ephemeral: true });
        }
        if (result && result.value) {
          return interaction.reply({ 
            content: '⚠️ Já existe uma credencial cadastrada. Use o botão "Excluir Credencial" antes de cadastrar uma nova.', 
            ephemeral: true 
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_credencial')
          .setTitle('🔐 Cadastrar Credencial MP');

        const tokenInput = new TextInputBuilder()
          .setCustomId('token')
          .setLabel('Access Token (TEST- ou APP-)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Cole seu Access Token aqui');

        const actionRow = new ActionRowBuilder().addComponents(tokenInput);
        modal.addComponents(actionRow);
        await interaction.showModal(modal);
      });
    }

    else if (customId === 'log_credencial') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }

      db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, result) => {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao buscar credencial.', ephemeral: true });
        }
        if (!result || !result.value) {
          return interaction.reply({ content: 'ℹ️ Nenhuma credencial cadastrada ainda.', ephemeral: true });
        }
        interaction.reply({ content: `🔑 Credencial atual: \`${result.value}\``, ephemeral: true });
      });
    }

    else if (customId === 'excluir_credencial') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
      }

      db.run(`DELETE FROM config WHERE key = 'mp_access_token'`, function(err) {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao excluir credencial.', ephemeral: true });
        }
        if (this.changes === 0) {
          return interaction.reply({ content: 'ℹ️ Nenhuma credencial estava cadastrada.', ephemeral: true });
        }
        interaction.reply({ content: '✅ Credencial excluída com sucesso!', ephemeral: true });
      });
    }

    // ========== BOTÕES DA CENTRAL DE COMANDOS ==========
    else if (customId === 'ver_catalogo') {
      await mostrarCatalogo(interaction);
    }
    else if (customId === 'ver_carrinho') {
      await mostrarCarrinho(interaction);
    }
    else if (customId === 'ajuda') {
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('❓ Ajuda')
        .setDescription(`
**Como comprar:**
1. Navegue pelo catálogo e escolha um produto.
2. Defina a quantidade e clique em "Comprar Agora" (gera um ticket) ou "Adicionar ao Carrinho".
3. No carrinho, você pode revisar itens e finalizar.
4. No ticket, use \`/email\` para gerar o PIX e pagar.
5. Após o pagamento, o produto será entregue automaticamente.

**Dúvidas?** Contate um administrador.
        `);
      interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ========== SELEÇÃO DE PRODUTO NO CATÁLOGO ==========
    else if (customId === 'selecionar_produto_catalogo') {
      const produtoId = interaction.values[0];
      db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], async (err, produto) => {
        if (err || !produto) {
          return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle('🛡️ Compra Segura')
          .setDescription(`**${produto.nome}**\n${produto.descricao}`)
          .addFields(
            { name: 'Valor', value: `R$ ${produto.valor.toFixed(2)}`, inline: true },
            { name: 'Estoque', value: 'Ilimitado', inline: true },
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

    // ========== BOTÕES DE AÇÃO SOBRE PRODUTO ==========
    else if (customId.startsWith('comprar_agora_')) {
      const produtoId = customId.replace('comprar_agora_', '');
      await abrirModalQuantidade(interaction, produtoId, 'comprar');
    }
    else if (customId.startsWith('add_carrinho_')) {
      const produtoId = customId.replace('add_carrinho_', '');
      await abrirModalQuantidade(interaction, produtoId, 'carrinho');
    }

    // ========== BOTÕES DO CARRINHO ==========
    else if (customId.startsWith('remover_item_')) {
      const itemId = customId.replace('remover_item_', '');
      db.run(`DELETE FROM carrinho_itens WHERE id = ?`, [itemId], function(err) {
        if (err) {
          interaction.reply({ content: '❌ Erro ao remover item.', ephemeral: true });
        } else {
          interaction.reply({ content: '✅ Item removido.', ephemeral: true });
        }
      });
    }
    else if (customId === 'finalizar_compra') {
      await interaction.deferReply({ ephemeral: true });
      await finalizarCompra(interaction, client);
    }

    // ========== BOTÕES DE TICKET ==========
    else if (customId.startsWith('confirmar_')) {
      if (!interaction.member.roles.cache.has(process.env.VENDEDOR_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas vendedores.', ephemeral: true });
      }
      const pedidoId = customId.split('_')[1];
      const channel = interaction.channel;

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
   
