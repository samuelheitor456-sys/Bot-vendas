const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limparcredencial')
    .setDescription('Remove a credencial do Mercado Pago configurada (apenas admin)'),

  async execute(interaction) {
    const adminRole = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRole)) {
      return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
    }

    db.run(`DELETE FROM config WHERE key = 'mp_access_token'`, function(err) {
      if (err) {
        console.error(err);
        return interaction.reply({ content: '❌ Erro ao remover credencial.', ephemeral: true });
      }
      if (this.changes === 0) {
        return interaction.reply({ content: 'ℹ️ Nenhuma credencial estava configurada.', ephemeral: true });
      }
      interaction.reply({ content: '✅ Credencial removida com sucesso. Use `/credencial` para configurar uma nova.', ephemeral: true });
    });
  }
};
