import { Events, type Client } from 'discord.js';
import { transcriptConfig } from '../config/env.js';
import { createTicketLogEmbed } from '../services/embedFactory.js';

const bypassRegex = /(paypal|cashapp|crypto|outside discord|off-platform)/i;

export const registerMessageCreateEvent = (client: Client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) {
      return;
    }

    if (!bypassRegex.test(message.content)) {
      return;
    }

    if (!transcriptConfig.service) {
      return;
    }

    const transcriptChannel = await message.guild.channels.fetch(transcriptConfig.service);
    if (!transcriptChannel?.isTextBased()) {
      return;
    }

    await transcriptChannel.send({
      embeds: [
        createTicketLogEmbed(
          'Anti-Bypass Alert',
          `User: <@${message.author.id}>\nChannel: <#${message.channelId}>\nMessage: ${message.content.slice(0, 1000)}`
        )
      ]
    });
  });
};
