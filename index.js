require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');
const express = require('express');

const app = express();
app.use(express.json());

// ==================== ROTAS DO WEBHOOK ====================
app.get('/', (req, res) => res.send('OK'));
app.get('/webhook', (req, res) => res.send('Webhook endpoint ativo. Use POST.'));

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

        db.get(`SELECT * FROM pedidos WHERE pagamento_id = ? OR pagamento_id = ?`, 
          [paymentId, paymentId + '.0'], async (err, pedido) => {
          if (err || !pedido) {
            console.log('❌ Pedido não encontrado para pagamento_id:', paymentId);
            return res.sendStatus(404);
          }
          console.log('📦 Pedido encontrado:', pedido.pedido_id);

          db.run(`UPDATE pedidos SET status = 'concluido', concluido_em = datetime('now') WHERE id = ?`, [pedido.id]);

          db.all(`SELECT * FROM pedido_itens WHERE pedido_id = ?`, [pedido.pedido_id], async (err, itens) => {
            if (err) console.error('Erro ao buscar itens do pedido:', err);

            const guild = client.guilds.cache.first();
            if (!guild) {
              console.log('❌ Nenhum servidor encontrado.');
              return res.sendStatus(200);
            }

            const canal = guild.channels.cache.find(c => c.name === pedido.pedido_id);
            let links = [];

            if (itens && itens.length > 0) {
              for (const item of itens) {
                const produto = await new Promise((resolve) => {
                  db.get(`SELECT link FROM produtos WHERE id = ?`, [item.produto_id], (err, row) => resolve(row));
                });
                if (produto) links.push(produto.link);
              }
            } else {
              const produto = await new Promise((resolve) => {
                db.get(`SELECT link FROM produtos WHERE id = ?`, [pedido.produto_id], (err, row) => resolve(row));
              });
              if (produto) links.push(produto.link);
            }

            // Envia DM para o cliente
            try {
              const user = await client.users.fetch(pedido.comprador_id);
              if (user) {
                const dmMessage = `Muito obrigado pela compra!\nNós da equipe Payzex agradecemos muito!\n\nSeu pedido está logo abaixo:\n${links.join('\n')}`;
                await user.send(dmMessage);
                console.log(`✅ Produto enviado por DM para ${user.tag}`);
              }
            } catch (e) {
              console.error('❌ Erro ao enviar DM:', e);
            }

            // Envia mensagem no ticket (se ainda existir)
            if (canal) {
              await canal.send('✅ **Pagamento efetuado!** Muito obrigado ❤️\nEnviamos seu produto na sua DM.');
              console.log(`✅ Mensagem enviada no canal ${pedido.pedido_id}`);
            }

            // Atribuir cargo se existir
            if (pedido.produto_id) {
              db.get(`SELECT cargo_id FROM produtos WHERE id = ?`, [pedido.produto_id], async (err, produto) => {
                if (produto && produto.cargo_id) {
                  try {
                    const member = await guild.members.fetch(pedido.comprador_id);
                    if (member) {
                      await member.roles.add(produto.cargo_id);
                      console.log(`✅ Cargo atribuído ao usuário ${member.user.tag}`);
                    }
                  } catch (roleError) {
                    console.error('❌ Erro ao atribuir cargo:', roleError);
                  }
                }
              });
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
    GatewayIntentBits.GuildMembers,
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
  // Comandos de barra
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client, db);
    } catch (error) {
      console.error(`Erro no comando ${interaction.commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Erro ao executar comando.', ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: '❌ Erro ao executar comando.' });
      }
    }
  }
  // Botões, modais e menus
  else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
    let handlerPath;
    if (interaction.isButton()) handlerPath = './handlers/buttonHandler';
    else if (interaction.isModalSubmit()) handlerPath = './handlers/modalHandler';
    else handlerPath = './handlers/selectHandler';

    try {
      const handler = require(handlerPath);
      await handler(interaction, client, db);
    } catch (error) {
      console.error('Erro no handler:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Erro ao processar interação.', ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: '❌ Erro ao processar interação.' });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
module.exports.client = client;
