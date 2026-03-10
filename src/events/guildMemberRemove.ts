import { Events, type Client } from 'discord.js';
import { prisma } from '../services/prisma.js';

export const registerGuildMemberRemoveEvent = (client: Client) => {
  client.on(Events.GuildMemberRemove, async (member) => {
    const openTickets = await prisma.ticket.findMany({ where: { creatorId: member.id, status: 'Open' } });
    if (openTickets.length === 0) {
      return;
    }

    await prisma.ticket.updateMany({ where: { creatorId: member.id, status: 'Open' }, data: { status: 'Closed' } });
  });
};
