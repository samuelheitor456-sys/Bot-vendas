const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('configembed')
    .setDescription('Configura a thumbnail padrão dos produtos (admin)'),

  async execute(interaction) {
    const { isAdmin } = require('../utils/permissions');
if (!await isAdmin(interaction.member)) {
  return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
}

    const embed = new EmbedBuilder()
      .setColor("#33FF33")
      .setTitle("__**DEFINA THUMB EMBED**__")
      .setDescription("Leia as informações antes")
      .addFields({
        name: "• Pra que serve ?",
        value: "Aqui você irá definir a thumb que irá ficar na parte superior direita do embed do produto.",
        inline: true
      })
      .setImage("https://cdn.discordapp.com/attachments/1477322750229090507/1478878249173127208/standard_2.gif?ex=69aaa8f2&is=69a95772&hm=dcbec749642c8c80bbf582c96106a83ef108d112cf9eed98b87f1fd9bcf34ac4&")
      .setThumbnail("https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png")
      .setFooter({
        text: "PAYZEX SISTEMA DE EMBED",
        iconURL: "https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png"
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('definir_thumb')
        .setLabel('Definir embed')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Mensagem de configuração enviada!', ephemeral: true });
  }
};
