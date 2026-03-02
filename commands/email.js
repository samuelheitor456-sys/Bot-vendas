const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const gerarPix = require('../utils/gerarPix');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('email')
    .setDescription('Informe seu e-mail para gerar o PIX')
    .addStringOption(option => option.setName('endereco').setDescription('Seu e-mail').setRequired(true)),

  async execute(interaction, client) {
    // Verificação de credencial do Mercado Pago
    const token = await new Promise((resolve) => {
      db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, row) => {
        resolve(row?.value);
      });
    });
    if (!token) {
      return interaction.reply({ content: '❌ Credencial do Mercado Pago não configurada. Um administrador precisa usar o comando `/credencial` primeiro.', ephemeral: true });
    }

    const email = interaction.options.getString('endereco');
    const channel = interaction.channel;

    if (!channel.name.startsWith('pedido-')) {
      return interaction.reply({ content: '❌ Este comando só pode ser usado em um ticket.', ephemeral: true });
    }

    const pedidoId = channel.name;

    db.run(`UPDATE pedidos SET comprador_email = ? WHERE pedido_id = ?`, [email, pedidoId], async function(err) {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao salvar e-mail.', ephemeral: true });
      }

      db.get(`SELECT * FROM pedidos WHERE pedido_id = ?`, [pedidoId], async (err, pedido) => {
        if (err || !pedido) {
          return interaction.reply({ content: '❌ Pedido não encontrado.', ephemeral: true });
        }

        try {
          const { embed, attachment } = await gerarPix(pedido, email);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`copiar_${pedido.pedido_id}`)
              .setLabel('📋 Copiar chave PIX')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('💳')
          );

          await interaction.reply({
            embeds: [embed],
            components: [row],
            files: [attachment]
          });
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: '❌ Erro ao gerar PIX.', ephemeral: true });
        }
      });
    });
  }
};
