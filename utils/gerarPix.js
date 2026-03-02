const mercadopago = require('mercadopago');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database/db'); // importa o banco

module.exports = async function gerarPix(pedido, email) {
  // Busca a credencial do banco
  const token = await new Promise((resolve, reject) => {
    db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, row) => {
      if (err || !row || !row.value) reject(new Error('Credencial do Mercado Pago não configurada. Use /credencial.'));
      else resolve(row.value);
    });
  });

  mercadopago.configure({ access_token: token });

  const payment_data = {
    transaction_amount: pedido.valor,
    description: `Pedido ${pedido.pedido_id}`,
    payment_method_id: 'pix',
    payer: { email },
  };

  const response = await mercadopago.payment.create(payment_data);
  const payment = response.body;

  const qr_code = payment.point_of_interaction.transaction_data.qr_code;
  const qr_code_base64 = payment.point_of_interaction.transaction_data.qr_code_base64;

  await new Promise((resolve, reject) => {
    db.run(`UPDATE pedidos SET pagamento_id = ?, qr_code = ? WHERE pedido_id = ?`,
      [payment.id, qr_code, pedido.pedido_id],
      function(err) {
        if (err) {
          console.error('❌ Erro ao salvar pagamento_id:', err);
          reject(err);
        } else {
          console.log('✅ pagamento_id salvo:', payment.id);
          resolve();
        }
      }
    );
  });

  const buffer = Buffer.from(qr_code_base64, 'base64');
  const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });

  const embed = new EmbedBuilder()
    .setColor(0x00BFFF)
    .setAuthor({ name: '💳 PAGAMENTO PIX' })
    .setTitle(pedido.pedido_id)
    .setDescription(`
━━━━━━━━━━━━━━━━━━
**Valor:** R$ ${pedido.valor}
**E-mail:** ${email}
━━━━━━━━━━━━━━━━━━
1️⃣ Abra o app do banco
2️⃣ Escaneie o QR Code
3️⃣ Confirme o pagamento
━━━━━━━━━━━━━━━━━━
✅ Pagamento seguro via Mercado Pago
    `)
    .setImage('attachment://qrcode.png')
    .setTimestamp();

  return { embed, attachment, qr_code };
};
