const mercadopago = require('mercadopago');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

mercadopago.configure({ access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN });

module.exports = async function gerarPix(pedido, email) {
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

  const db = require('../database/db');
  await new Promise((resolve, reject) => {
    db.run(`UPDATE pedidos SET pagamento_id = ?, qr_code = ? WHERE pedido_id = ?`,
      [payment.id, qr_code, pedido.pedido_id],
      function(err) {
        if (err) reject(err);
        else resolve();
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
