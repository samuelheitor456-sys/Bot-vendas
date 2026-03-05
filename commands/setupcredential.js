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
      .setColor(0x9B59B6)
      .setTitle('🔐 Configuração da Credencial Mercado Pago')
      .setDescription(`
Para que o bot possa gerar PIX e processar pagamentos, é necessário configurar o **Access Token** do Mercado Pago.

**O que é?**  
É uma chave que identifica sua conta no Mercado Pago. Você pode obtê-la no [painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel).

**Como obter:**  
1. Acesse o link acima e faça login.  
2. Crie ou selecione uma aplicação.  
3. Na seção "Credenciais", copie o **Access Token** (começa com TEST- ou APP-).  
4. Clique no botão abaixo e cole o token.

**Importante:**  
- Use **TEST-** para testes, **APP-** para produção.  
- A credencial ficará salva no banco de dados.
      `)
      .setFooter({ text: 'Apenas administradores podem usar estes botões.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('cadastrar_credencial')
        .setLabel('📝 Cadastrar Credencial')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔑'),
      new ButtonBuilder()
        .setCustomId('log_credencial')
        .setLabel('📋 Ver Credencial')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId('excluir_credencial')
        .setLabel('🗑️ Excluir Credencial')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Canal de configuração criado!', ephemeral: true });
  }
};
