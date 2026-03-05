const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargoadmin')
    .setDescription('Configura o cargo de administrador (dono) do bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor("#33FF33")
      .setTitle("__**DEFINA CARGO DONO**__")
      .setDescription("Leia as informações antes")
      .addFields({
        name: "• Pra que serve ?",
        value: "• Você precisa cadastrar um cargo de dono, antes de conhecer as demais opções, cadastre o cargo que você quiser, e apenas quem tiver este cargo vai poder executar os demais comandos disponíveis.",
        inline: true
      })
      .setImage("https://cdn.discordapp.com/attachments/1477322750229090507/1478878249173127208/standard_2.gif?ex=69aaa8f2&is=69a95772&hm=dcbec749642c8c80bbf582c96106a83ef108d112cf9eed98b87f1fd9bcf34ac4&")
      .setThumbnail("https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png")
      .setFooter({
        text: "PAYZEX SISTEMA CARGO DONO",
        iconURL: "https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png"
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('definir_cargo_admin')
        .setLabel('Definir Cargo')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Mensagem de configuração enviada!', ephemeral: true });
  }
};
