const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cupom')
    .setDescription('Sistema de cupons')
    .addSubcommand(sub =>
      sub.setName('criar')
        .setDescription('Criar cupom (admin)')
        .addStringOption(opt => opt.setName('codigo').setDescription('Código do cupom').setRequired(true))
        .addStringOption(opt => opt.setName('tipo').setDescription('Tipo').setRequired(true).addChoices(
          { name: 'Porcentagem', value: 'porcentagem' },
          { name: 'Fixo', value: 'fixo' }
        ))
        .addNumberOption(opt => opt.setName('valor').setDescription('Valor do desconto').setRequired(true))
        .addIntegerOption(opt => opt.setName('usos').setDescription('Limite de usos').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('aplicar')
        .setDescription('Aplicar cupom ao carrinho')
        .addStringOption(opt => opt.setName('codigo').setDescription('Código do cupom').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'criar') {
      if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return interaction.reply({ content: '❌ Apenas admin.', ephemeral: true });
      }
      const codigo = interaction.options.getString('codigo');
      const tipo = interaction.options.getString('tipo');
      const valor = interaction.options.getNumber('valor');
      const usos = interaction.options.getInteger('usos') || 1;

      db.run(`INSERT INTO cupons (codigo, tipo, valor, usos_max) VALUES (?, ?, ?, ?)`,
        [codigo, tipo, valor, usos], function(err) {
          if (err) return interaction.reply({ content: '❌ Cupom já existe ou erro.', ephemeral: true });
          interaction.reply({ content: `✅ Cupom ${codigo} criado.`, ephemeral: true });
        });
    } else if (sub === 'aplicar') {
      const codigo = interaction.options.getString('codigo');
      // Lógica para aplicar cupom (deve modificar o valor final no carrinho)
      // Implementar conforme necessidade
      interaction.reply({ content: '⏳ Funcionalidade em desenvolvimento.', ephemeral: true });
    }
  }
};
