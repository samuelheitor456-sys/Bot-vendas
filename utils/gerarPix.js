const mercadopago = require('mercadopago');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = async function gerarPix(pedido, email, user, quantidade) {
  // Busca a credencial do banco
  const token = await new Promise((resolve, reject) => {
    db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, row) => {
      if (err || !row || !row.value) {
        reject(new Error('Credencial do Mercado Pago não configurada. Use /credencial.'));
      } else {
        resolve(row.value);
      }
    });
  });

  // Configura o Mercado Pago com o token obtido
  mercadopago.configure({ access_token: token });

  // Busca o produto no banco de dados usando o produto_id do pedido
  const produto = await new Promise((resolve, reject) => {
    db.get(`SELECT * FROM produtos WHERE id = ?`, [pedido.produto_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!produto) {
    throw new Error('Produto não encontrado para este pedido.');
  }

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
        if (err) reject(err);
        else resolve();
      }
    );
  });

  const buffer = Buffer.from(qr_code_base64, 'base64');
  const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });

  const embed = new EmbedBuilder()
    .setColor("#33FF33")
    .setTitle(`COMPRA - **${produto.nome}**`)
    .setDescription(`Olá ${user}, você selecionou para adquirir nosso **${produto.nome}**, que excelente escolha!`)
    .addFields(
      { name: "Valor", value: `R$ **${(produto.valor * quantidade).toFixed(2)}**`, inline: true },
      { name: "Entrega", value: "Automática", inline: true },
      { name: "Status Pagamento", value: "Pendente", inline: true },
      { name: "Produto", value: `**${produto.nome}**`, inline: true },
      { name: "Pagamento", value: "Via Pix", inline: true },
      { name: "By", value: "Payzex", inline: true }
    )
    .setThumbnail('attachment://qrcode.png')
    .addFields({ name: "Chave Pix", value: `\`\`\`${qr_code}\`\`\`` })
    .setFooter({
      text: "PAYZEX • SISTEMA PAGAMENTO",
      iconURL: "https://cdn.discordapp.com/attachments/1475581562325176530/1478465217066307695/IMG_20260302_164525.png"
    })
    .setTimestamp();

  return { embed, attachment, qr_code };
};
