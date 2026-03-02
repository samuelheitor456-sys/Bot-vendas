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

    // ========== MODAL DE PRODUTO ==========
    else if (interaction.customId === 'modal_produto') {
      const nome = interaction.fields.getTextInputValue('nome');
      const descricao = interaction.fields.getTextInputValue('descricao');
      const valor = parseFloat(interaction.fields.getTextInputValue('valor'));
      const link = interaction.fields.getTextInputValue('link');
      const imagem = interaction.fields.getTextInputValue('imagem');
      const estoqueInput = interaction.fields.getTextInputValue('estoque');

      // Validações
      if (isNaN(valor) || valor <= 0) {
        return interaction.reply({ content: '❌ Valor inválido.', ephemeral: true });
      }
      if (!imagem.startsWith('http')) {
        return interaction.reply({ content: '❌ URL da imagem deve começar com http:// ou https://', ephemeral: true });
      }

      // Processar estoque: se vazio, -1 (ilimitado); senão, converte para inteiro
      let estoque = -1;
      if (estoqueInput && estoqueInput.trim() !== '') {
        estoque = parseInt(estoqueInput);
        if (isNaN(estoque) || estoque < 0) {
          return interaction.reply({ content: '❌ Estoque deve ser um número não negativo.', ephemeral: true });
        }
      }

      let canalId = await new Promise((resolve) => {
        db.get(`SELECT value FROM config WHERE key = 'canal_vendas'`, (err, row) => {
          resolve(row?.value || null);
        });
      });

      let canal;
      if (canalId) canal = client.channels.cache.get(canalId);
      if (!canal) canal = interaction.channel;

      if (!canal) {
        return interaction.reply({ content: '❌ Não foi possível determinar um canal para publicar o produto.', ephemeral: true });
      }

      db.run(`INSERT INTO produtos (nome, descricao, valor, link, imagem, canal_id, estoque) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nome, descricao, valor, link, imagem, canal.id, estoque],
        function(err) {
          if (err) {
            console.error('❌ Erro ao inserir produto:', err);
            return interaction.reply({ content: '❌ Erro ao salvar produto no banco de dados.', ephemeral: true });
          }

          const produtoId = this.lastID;

          const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🛡️ Compra Segura')
            .setDescription(`**${nome}**\n${descricao}`)
            .addFields({
              name: '💳 Informações',
              value: `💰 R$ ${valor.toFixed(2)}  |  📦 ${estoque === -1 ? 'Ilimitado' : estoque + ' unidades'}  |  📬 Automática`
            })
            .setImage(imagem)
            .setFooter({ text: `BOT DE VENDAS PRIME WOLF PACK | Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`add_carrinho_${produtoId}`)
              .setLabel('Adicionar ao carrinho')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('➕'),
            new ButtonBuilder()
              .setCustomId(`comprar_agora_${produtoId}`)
              .setLabel('Comprar agora')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🛒')
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

    // ========== MODAL DE QUANTIDADE ==========
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

        // Verificar estoque
        if (produto.estoque !== -1 && produto.estoque < quantidade) {
          return interaction.reply({ content: `❌ Estoque insuficiente. Disponível: ${produto.estoque} unidades.`, ephemeral: true });
        }

        if (acao === 'comprar') {
          // Lógica de compra direta com quantidade
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

          // Dar baixa no estoque (apenas se não for ilimitado)
          if (produto.estoque !== -1) {
            const novoEstoque = produto.estoque - quantidade;
            db.run(`UPDATE produtos SET estoque = ? WHERE id = ?`, [novoEstoque, produto.id]);
          }

          // ==================== MENSAGEM PROFISSIONAL DO TICKET (COMPRA DIRETA) ====================
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
            // Verifica se já existe o mesmo produto no carrinho para somar quantidades? Por simplicidade, insere novo.
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
  } catch (error) {
    console.error('❌ Erro no modalHandler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.', ephemeral: true });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.' });
    }
  }
};
