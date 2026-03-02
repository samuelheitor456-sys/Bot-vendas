const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const gerarPix = require('../utils/gerarPix');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('email')
    .setDescription('Informe seu e-mail para gerar o PIX')
    .addStringOption(option =>
      option.setName('endereco')
        .setDescription('Seu e-mail')
        .setRequired(true)),

  async execute(interaction, client, db) {
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
          await interaction.reply({ embeds: [embed], files: [attachment] });
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: '❌ Erro ao gerar PIX.', ephemeral: true });
        }
      });
    });
  }
};
