require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');
const express = require('express');
const mercadopago = require('mercadopago');

// Configura Mercado Pago
mercadopago.configure({ access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN });

const app = express();
app.use(express.json());

// Rotas do servidor web
app.get('/', (req, res) => res.send('OK'));
app.get('/webhook', (req, res) => res.send('Webhook endpoint ativo. Use POST.'));

// Webhook principal
app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recebido:', JSON.stringify(req.body, null, 2));
  const { body } = req;

  if (body.data?.id === '123456') {
    console.log('ℹ️ Notificação de teste ignorada.');
    return res.sendStatus(200);
  }

  if (body.type === 'payment') {
    const paymentId = String(body.data.id);
    console.log(`🔍 Payment ID: ${paymentId}`);

    try {
      // Busca a credencial do banco
      const token = await new Promise((resolve, reject) => {
        db.get(`SELECT value FROM config WHERE key = 'mp_access_token'`, (err, row) => {
          if (err || !row || !row.value) reject(new Error('Credencial não configurada'));
          else resolve(row.value);
        });
      });

      const mercadopago = require('mercadopago');
      mercadopago.configure({ access_token: token });

      const payment = await mercadopago.payment.get(paymentId);
      console.log(`📊 Status: ${payment.body.status}`);

      if (payment.body.status === 'approved') {
        console.log('✅ Pagamento aprovado. Buscando pedido...');

        db.get(`SELECT * FROM pedidos WHERE pagamento_id = ?`, [paymentId], async (err, pedido) => {
          if (err) {
            console.error('❌ Erro ao buscar pedido:', err);
            return res.sendStatus(500);
          }
          if (!pedido) {
            console.log('❌ Pedido não encontrado para pagamento_id:', paymentId);
            db.all(`SELECT pedido_id, pagamento_id FROM pedidos`, (err2, rows) => {
              if (!err2) {
                console.log('📋 Pedidos no banco:');
                rows.forEach(r => console.log(`  ${r.pedido_id}: "${r.pagamento_id}"`));
              }
            });
            return res.sendStatus(404);
          }
          console.log('📦 Pedido encontrado:', pedido.pedido_id);

          db.run(`UPDATE pedidos SET status = 'concluido', concluido_em = datetime('now') WHERE id = ?`, [pedido.id]);

          db.get(`SELECT * FROM produtos WHERE id = ?`, [pedido.produto_id], async (err, produto) => {
            if (err || !produto) {
              console.log('❌ Produto não encontrado');
              return res.sendStatus(200);
            }

            console.log('🎁 Produto:', produto.nome);

            const guild = client.guilds.cache.first();
            if (!guild) {
              console.log('❌ Nenhum servidor encontrado.');
              return res.sendStatus(200);
            }

            const canal = guild.channels.cache.find(c => c.name === pedido.pedido_id);
            if (canal) {
              await canal.send(`✅ **Pagamento confirmado!** Aqui está seu produto:\n${produto.link}`);
              console.log(`✅ Produto entregue no canal ${pedido.pedido_id}`);
            } else {
              console.log(`⚠️ Canal ${pedido.pedido_id} não encontrado, tentando DM...`);
              try {
                const user = await client.users.fetch(pedido.comprador_id);
                if (user) await user.send(`✅ **Pagamento confirmado!** Aqui está seu produto:\n${produto.link}`);
              } catch (e) {
                console.error('❌ Erro ao enviar DM:', e);
              }
            }

            // Atribuir cargo se existir
            if (produto.cargo_id) {
              console.log(`🎫 Tentando atribuir cargo ${produto.cargo_id} ao comprador ${pedido.comprador_id}`);
              try {
                const member = await guild.members.fetch(pedido.comprador_id);
                if (member) {
                  await member.roles.add(produto.cargo_id);
                  console.log(`✅ Cargo atribuído ao usuário ${member.user.tag}`);
                } else {
                  console.log('❌ Membro não encontrado no servidor.');
                }
              } catch (roleError) {
                console.error('❌ Erro ao atribuir cargo:', roleError);
              }
            }

            res.sendStatus(200);
          });
        });
      } else {
        res.sendStatus(200);
      }
    } catch (error) {
      console.error('❌ Erro no webhook:', error.message);
      if (error.message.includes('Credencial não configurada')) {
        console.log('⚠️ Credencial do Mercado Pago não configurada. Use /credencial.');
      }
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(200);
  }
});
          

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor webhook rodando na porta ${PORT}`);
});

// ==================== BOT DISCORD ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // necessário para gerenciar cargos
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();

// Carregar comandos da pasta commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
  console.log(`✅ Bot logado como ${client.user.tag}`);

  const { REST } = require('@discordjs/rest');
  const { Routes } = require('discord-api-types/v10');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    const commands = client.commands.map(c => c.data.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Comandos slash registrados globalmente');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client, db);
    } catch (error) {
      console.error(`Erro no comando ${interaction.commandName}:`, error);
      await interaction.reply({ content: '❌ Erro ao executar comando.', ephemeral: true });
    }
  } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
    let handlerPath;
    if (interaction.isButton()) handlerPath = './handlers/buttonHandler';
    else if (interaction.isModalSubmit()) handlerPath = './handlers/modalHandler';
    else handlerPath = './handlers/selectHandler';

    try {
      const handler = require(handlerPath);
      await handler(interaction, client, db);
    } catch (error) {
      console.error('Erro no handler:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Erro ao processar interação.', ephemeral: true });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
module.exports.client = client;
