const db = require('../database/db');

module.exports = async (interaction, client) => {
  if (interaction.customId !== 'selecionar_canal') return;

  const canalId = interaction.values[0];

  db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, ['canal_vendas', canalId], (err) => {
    if (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Erro ao salvar configuração.', ephemeral: true });
    }
    interaction.reply({ content: `✅ Canal de vendas definido para <#${canalId}>.`, ephemeral: true });
  });
};
