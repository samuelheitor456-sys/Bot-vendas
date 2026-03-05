const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupcredential')
    .setDescription('Cria o canal de configuração da credencial do Mercado Pago (admin)'),

  async execute(interaction) {
    const { isAdmin } = require('../utils/permissions');
if (!await isAdmin(interaction.member)) {
  return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
}
    const embed = new EmbedBuilder()
      .setColor("#33FF33")
      .setTitle("__**CADASTRE SUA CREDENCIAL MERCADO PAGO**__")
      .setDescription("Leia as informações primeiro")
      .addFields(
        {
          name: "• Pra que serve isso ?",
          value: "• A credencial Mercado Pago serve para você receber o pagamento de qualquer produto na sua conta Mercado Pago.",
          inline: true
        },
        {
          name: "• Como obter a credencial ?",
          value: "• Recomendamos que você assista algum tutorial no YouTube de como pegar credencial Mercado Pago. Lá irão ensinar o passo a passo.",
          inline: true
        }
      )
      .setImage("https://cdn.discordapp.com/attachments/1477322750229090507/1478878249173127208/standard_2.gif?ex=69aaa8f2&is=69a95772&hm=dcbec749642c8c80bbf582c96106a83ef108d112cf9eed98b87f1fd9bcf34ac4&")
      .setThumbnail("https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png")
      .setFooter({
        text: "PAYZEX SISTEMA CADASTRAMENTO CREDENCIAL",
        iconURL: "https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png"
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('cadastrar_credencial')
        .setLabel('Enviar Credencial')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('log_credencial')
        .setLabel('Logs')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('excluir_credencial')
        .setLabel('Excluir')
        .setStyle(ButtonStyle.Danger)
    );
    

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Canal de configuração criado!', ephemeral: true });
  }
};
