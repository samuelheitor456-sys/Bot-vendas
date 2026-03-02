const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

module.exports = async (interaction, client) => {
  try {
    // Modal de produto (adicionar produto)
    if (interaction.customId === 'modal_produto') {
      const nome = interaction.fields.getTextInputValue('nome');
      const descricao = interaction.fields.getTextInputValue('descricao');
      const valor = parseFloat(interaction.fields.getTextInputValue('valor'));
      const link = interaction.fields.getTextInputValue('link');
      const imagem = interaction.fields.getTextInputValue('imagem');

      // Validações
      if (isNaN(valor) || valor <= 0) {
        return interaction.reply({ content: '❌ Valor inválido.', ephemeral: true });
      }
      if (!imagem.startsWith('http')) {
        return interaction.reply({ content: '❌ URL da imagem deve começar com http:// ou https://', ephemeral: true });
      }

      // Tenta pegar o canal de vendas configurado, se não existir, usa o canal atual
      let canalId = await new Promise((resolve) => {
        db.get(`SELECT value FROM config WHERE key = 'canal_vendas'`, (err, row) => {
          if (err) {
            console.error('Erro ao buscar canal_vendas:', err);
            resolve(null);
          } else {
            resolve(row?.value || null);
          }
        });
      });

      let canal;
      if (canalId) {
        canal = client.channels.cache.get(canalId);
      }
      if (!canal) {
        canal = interaction.channel; // fallback para o canal atual
        console.log('⚠️ Canal de vendas não configurado, usando canal atual.');
      }

      if (!canal) {
        return interaction.reply({ content: '❌ Não foi possível determinar um canal para publicar o produto.', ephemeral: true });
      }

      // Insere produto no banco
      db.run(`INSERT INTO produtos (nome, descricao, valor, link, imagem, canal_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [nome, descricao, valor, link, imagem, canal.id],
        function(err) {
          if (err) {
            console.error('❌ Erro ao inserir produto:', err);
            return interaction.reply({ content: '❌ Erro ao salvar produto no banco de dados.', ephemeral: true });
          }

          const produtoId = this.lastID;

          // Embed do produto com um único campo para todos os detalhes (garante linha horizontal)
          const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🛡️ Compra Segura')
            .setDescription(`**${nome}**\n${descricao}`)
            .addFields({
              name: '💳 Informações',
              value: `💰 R$ ${valor.toFixed(2)}  |  📦 Ilimitado  |  📬 Automática`
            })
            .setImage(imagem)
            .setFooter({ text: `BOT DE VENDAS PRIME WOLF PACK | Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` })
            .setTimestamp();

          // Botões: Adicionar ao carrinho e Comprar agora
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

          // Envia no canal
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

    // Modal de quantidade (para comprar/adicionar ao carrinho)
    else if (interaction.customId === 'modal_quantidade') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade'));
      const produtoId = interaction.fields.getTextInputValue('produto_id');
      const acao = interaction.fields.getTextInputValue('acao');

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ Quantidade inválida.', ephemeral: true });
      }

      db.get(`SELECT * FROM produtos WHERE id = ?`, [produtoId], async (err, produto) => {
        if (err || !produto) {
          console.error('Erro ao buscar produto:', err);
          return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
        }

        if (acao === 'comprar') {
          // Lógica para criar ticket com quantidade
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
**🛒 NOVO PEDIDO** • <@&${vendedorRole}>
━━━━━━━━━━━━━━━━━━━━━━━━

**👤 Cliente:** ${user}
**🛍️ Produto:** **${produto.nome}** x${quantidade}
**💰 Valor total:** **R$ ${valorTotal.toFixed(2)}**

📌 Digite \`/email seu@email.com\` para gerar o PIX.
━━━━━━━━━━━━━━━━━━━━━━━━
          `;

          await ticketChannel.send({ content: mensagem, components: [row] });
        }
        else if (acao === 'carrinho') {
          // Adiciona ao carrinho
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
  } catch (error) {
    console.error('❌ Erro no modalHandler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.', ephemeral: true });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.' });
    }
  }
};
