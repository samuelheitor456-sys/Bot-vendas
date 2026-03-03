const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = async (interaction, client) => {
  try {
    // ========== MODAL DE CREDENCIAL ==========
    if (interaction.customId === 'modal_credencial') {
      const token = interaction.fields.getTextInputValue('token');
      if (!token.startsWith('TEST-') && !token.startsWith('APP-') && !token.startsWith('TEST_') && !token.startsWith('APP_')) {
        return interaction.reply({ content: '❌ Token inválido. Deve começar com TEST- ou APP- (ou _).', ephemeral: true });
      }
      db.run(`INSERT OR REPLACE INTO config (key, value) VALUES ('mp_access_token', ?)`, [token], function(err) {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao salvar credencial.', ephemeral: true });
        }
        interaction.reply({ content: '✅ Credencial salva com sucesso! O bot já pode gerar PIX.', ephemeral: true });
      });
    }

    // ========== MODAL DE PRODUTO (COM CANAL VIA CUSTOM ID) ==========
    else if (interaction.customId.startsWith('modal_produto_canal_')) {
      const canalId = interaction.customId.replace('modal_produto_canal_', '');
      const canal = client.channels.cache.get(canalId);
      if (!canal) {
        return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
      }

      const nome = interaction.fields.getTextInputValue('nome');
      const descricao = interaction.fields.getTextInputValue('descricao');
      const valor = parseFloat(interaction.fields.getTextInputValue('valor'));
      const link = interaction.fields.getTextInputValue('link');
      const imagem = interaction.fields.getTextInputValue('imagem');

      if (isNaN(valor) || valor <= 0) {
        return interaction.reply({ content: '❌ Valor inválido.', ephemeral: true });
      }
      if (!imagem.startsWith('http')) {
        return interaction.reply({ content: '❌ URL da imagem deve começar com http:// ou https://', ephemeral: true });
      }

      db.run(`INSERT INTO produtos (nome, descricao, valor, link, imagem, canal_id, estoque) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nome, descricao, valor, link, imagem, canal.id, -1],
        function(err) {
          if (err) {
            console.error('❌ Erro ao inserir produto:', err);
            return interaction.reply({ content: '❌ Erro ao salvar produto no banco de dados.', ephemeral: true });
          }

          const produtoId = this.lastID;

const embed = new EmbedBuilder()
  .setColor("#33FF33")
  .setTitle("__**🟢 COMPRA SEGURA**__")
  .setDescription(`**${nome}**\n${descricao}`)
  .addFields(
    {
      name: "Valor",
      value: `R$ ${valor.toFixed(2)}`,
      inline: true
    },
    {
      name: "Estoque",
      value: "Limitado",
      inline: true
    },
    {
      name: "Entrega",
      value: "Automática",
      inline: true
    },
    {
      name: "Suporte",
      value: "24 Horas",
      inline: true
    }
  )
  .setImage(imagem)
  .setThumbnail("https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png")
  .setFooter({
    text: "Bot Vendas Payzex",
    
    iconURL: "https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png"
  })
  .setTimestamp();

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId(`comprar_agora_${produtoId}`)
    .setLabel('Comprar')
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId(`add_carrinho_${produtoId}`)
    .setLabel('Adicionar ao Carrinho')
    .setStyle(ButtonStyle.Secondary)
);


          canal.send({ embeds: [embed], components: [row] })
            .then(() => {
              interaction.reply({ content: '✅ Produto publicado com sucesso!', ephemeral: true });
            })
            .catch(err => {
              console.error('❌ Erro ao enviar mensagem no canal:', err);
              interaction.reply({ content: '❌ Produto salvo, mas erro ao enviar mensagem no canal.', ephemeral: true });
            });
        }
      );
    }

    // ========== MODAL DE QUANTIDADE (com verificação de estoque) ==========
    else if (interaction.customId === 'modal_quantidade') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade'));
      const produtoId = interaction.fields.getTextInputValue('produto_id');
      const acao = interaction.fields.getTextInputValue('acao');

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ Quantidade inválida.', ephemeral: true });
      }

      db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], async (err, produto) => {
        if (err || !produto) {
          return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
        }

        if (produto.estoque !== -1 && produto.estoque < quantidade) {
          return interaction.reply({ content: `❌ Estoque insuficiente. Disponível: ${produto.estoque} unidades.`, ephemeral: true });
        }

        if (acao === 'comprar') {
          const guild = interaction.guild;
          const user = interaction.user;
          const vendedorRole = process.env.VENDEDOR_ROLE_ID;

          if (!vendedorRole) {
            return interaction.reply({ content: '❌ VENDEDOR_ROLE_ID não configurado.', ephemeral: true });
          }

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
            db.run(`INSERT INTO pedidos (pedido_id, pedido_numero, produto_id, comprador_id, valor, status) VALUES (?, ?, ?, ?, ?, ?)`,
              [pedidoId, pedidoNumero, produto.id, user.id, valorTotal, 'aguardando_pagamento'],
              function(err) { if (err) reject(err); else resolve(); });
          });

          if (produto.estoque !== -1) {
            const novoEstoque = produto.estoque - quantidade;
            db.run(`UPDATE produtos SET estoque = ? WHERE id = ?`, [novoEstoque, produto.id]);
          }

          const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🛒 **COMPRA DO PEDIDO ${pedidoNumero}**`)
            .setDescription(`
━━━━━━━━━━━━━━━━━━━━━━━━
**👤 RESPONSÁVEL:** <@&${vendedorRole}>
━━━━━━━━━━━━━━━━━━━━━━━━

**📦 PRODUTO:** ${produto.nome} x${quantidade}

**💰 VALOR:** R$ ${valorTotal.toFixed(2)}

**👤 CLIENTE:** ${user}

**📝 DESCRIÇÃO:** ${produto.descricao}

━━━━━━━━━━━━━━━━━━━━━━━━
**💳 PAGAMENTO VIA PIX**
━━━━━━━━━━━━━━━━━━━━━━━━

🔹 **Como gerar o Pix?**
Digite o comando abaixo neste canal:

\`\`\`
/email seu@email.com
\`\`\`

✅ **Pagamento 100% seguro processado pelo Mercado Pago**
⏱️ Após a confirmação, o produto será entregue automaticamente.

━━━━━━━━━━━━━━━━━━━━━━━━
            `)
            .setFooter({ 
              text: 'BOT DE VENDAS PRIME WOLF PACK | Confiança e segurança em cada compra', 
              iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' 
            })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`confirmar_${pedidoId}`)
              .setLabel('✅ CONFIRMAR VENDA')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
            new ButtonBuilder()
              .setCustomId(`fechar_${pedidoId}`)
              .setLabel('❌ FECHAR TICKET')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
          );

          await ticketChannel.send({ embeds: [embed], components: [row] });
          await interaction.reply({ content: `✅ **Ticket criado:** ${ticketChannel}`, ephemeral: true });
        }
        else if (acao === 'carrinho') {
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
      });
    }

    // ========== MODAL DE CARGO ==========
    else if (interaction.customId.startsWith('modal_cargo_')) {
      const produtoId = interaction.customId.replace('modal_cargo_', '');
      const cargoId = interaction.fields.getTextInputValue('cargo_id');
      db.run(`UPDATE produtos SET cargo_id = ? WHERE id = ?`, [cargoId, produtoId], function(err) {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao vincular cargo.', ephemeral: true });
        }
        interaction.reply({ content: `✅ Cargo vinculado ao produto ID ${produtoId}.`, ephemeral: true });
        setTimeout(() => interaction.deleteReply(), 2000);
      });
    }

    // ========== MODAL DE ESTOQUE ==========
    else if (interaction.customId.startsWith('modal_estoque_')) {
      const produtoId = interaction.customId.replace('modal_estoque_', '');
      const estoque = parseInt(interaction.fields.getTextInputValue('estoque'));
      if (isNaN(estoque) || estoque < -1) {
        return interaction.reply({ content: '❌ Valor inválido. Use -1 para ilimitado ou um número não negativo.', ephemeral: true });
      }
      db.run(`UPDATE produtos SET estoque = ? WHERE id = ?`, [estoque, produtoId], function(err) {
        if (err) {
          console.error(err);
          return interaction.reply({ content: '❌ Erro ao atualizar estoque.', ephemeral: true });
        }
        interaction.reply({ content: `✅ Estoque do produto ID ${produtoId} atualizado para ${estoque === -1 ? 'ilimitado' : estoque}.`, ephemeral: true });
        setTimeout(() => interaction.deleteReply(), 2000);
      });
    }
  } catch (error) {
    console.error('❌ Erro no modalHandler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.', ephemeral: true });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.' });
    }
  }
};
