import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import pino from 'pino';
import { env } from './config/env.js';
import { registerInteractionCreateEvent } from './events/interactionCreate.js';
import { registerThreadCreateEvent } from './events/threadCreate.js';
import { registerMessageCreateEvent } from './events/messageCreate.js';
import { registerGuildMemberRemoveEvent } from './events/guildMemberRemove.js';
import { prisma } from './services/prisma.js';

const logger = pino({ name: 'smp-hub-bot' });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

registerInteractionCreateEvent(client);
registerThreadCreateEvent(client);
registerMessageCreateEvent(client);
registerGuildMemberRemoveEvent(client);

client.once(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

setInterval(async () => {
  try {
    const monthly = await prisma.deal.aggregate({
      where: { status: 'Completed', updatedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) } },
      _sum: { commission: true }
    });
    logger.info({ monthlyCommission: Number(monthly._sum.commission ?? 0) }, 'Monthly commission snapshot');
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? { message: error.message, stack: error.stack } : error },
      'Failed to collect monthly commission snapshot'
    );
  }
}, 1000 * 60 * 60 * 6);

const shutdown = async () => {
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(env.DISCORD_TOKEN);
