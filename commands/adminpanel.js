const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminpanel')
    .setDescription('Abre o painel administrativo do bot (admin)'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas administradores.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor("#33FF33")
      .setTitle("**PAYZEX PRODUTOS**")
      .setDescription("Leia as informações primeiro")
      .addFields(
        {
          name: "**• Sistema**",
          value: "• Adicione quantos produtos você quiser, cada produto irá conter, Nome, Descrição, Capa, e Valor e Estoque",
          inline: true
        },
        {
          name: "**• Formas de pagamento**",
          value: "• todo o produto adicionados, terá apenas uma forma de pagamento, que será via pix, cada produto terá um valor fixo sem acréscimo taxa ou algo do tipo",
          inline: true
        },
        {
          name: "**• Como adicionar o produto**",
          value: "• Para adicionar um produto basta clicar em, \"Publicar\" em seguida definir seu canal de vendas, em seguida coloque as informações do seu produto, feito isso coloque um cargo personalizado no produto, clicando em \"Cargo\", feito isso defina o estoque clicando em \"Estoque\" feito isso sue produto estar prontinho",
          inline: true
        }
      )
      .setImage('https://cdn.discordapp.com/attachments/1477322750229090507/1478878249173127208/standard_2.gif?ex=69aa0032&is=69a8aeb2&hm=2a57eb55d7020843a5fbc7c5a865b3111ec5772abbee5560f8d25cc952da82d7&')
      .setThumbnail("https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png")
      .setFooter({
        text: "PAYZEX SISTEMA DE PRODUTOS",
        iconURL: "https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png"
      })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_adicionar_produto')
        .setLabel('Publicar')
        .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_adicionar_cargo')
        .setLabel('Cargo')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_adicionar_estoque')
        .setLabel('Estoque')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  }
};

    await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
    await interaction.reply({ content: '✅ Painel fixado no canal!', ephemeral: true });
  }
};
