import { ChannelType, Events, type Client } from 'discord.js';
import { env } from '../config/env.js';
import { createProviderAdEmbed } from '../services/embedFactory.js';
import { prisma } from '../services/prisma.js';
import type { ServiceType } from '../constants/serviceTypes.js';

const forumMap: Partial<Record<ServiceType, string>> = {
  builders: env.BUILDERS_FORUM_ID,
  developers: env.DEVELOPERS_FORUM_ID,
  artists: env.ARTISTS_FORUM_ID,
  editors: env.EDITORS_FORUM_ID
};

export const registerThreadCreateEvent = (client: Client) => {
  client.on(Events.ThreadCreate, async (thread) => {
    if (thread.parent?.type !== ChannelType.GuildForum || !thread.ownerId) {
      return;
    }

    const serviceType = (Object.keys(forumMap) as ServiceType[]).find((k) => forumMap[k] === thread.parentId);
    if (!serviceType) {
      return;
    }

    const provider = await prisma.provider.findUnique({ where: { discordId: thread.ownerId }, include: { services: true } });
    if (!provider || provider.isBlacklisted) {
      return;
    }

    const services = provider.services as Array<{ id: string; serviceType: string; portfolioLink: string }>;
    const existingService = services.find((service) => service.serviceType === serviceType);
    if (!existingService) {
      return;
    }

    if (provider.forumThreadId && provider.forumThreadId !== thread.id) {
      await thread.send('You already have an ad thread for your services. Please use `/update-ad`.');
      return;
    }

    const starter = await thread.fetchStarterMessage().catch(() => null);
    const description = starter?.content?.slice(0, 4000) || 'Provider ad';
    const embed = createProviderAdEmbed({
      providerTag: provider.username,
      providerId: provider.discordId,
      serviceType,
      description,
      portfolioLink: existingService.portfolioLink,
      averageRating: provider.averageRating,
      ratingCount: provider.ratingCount,
      totalDeals: provider.totalDeals
    });

    const adMessage = await thread.send({ embeds: [embed] });
    if (starter?.deletable) {
      await starter.delete().catch(() => null);
    }

    await prisma.provider.update({ where: { id: provider.id }, data: { forumThreadId: thread.id } });
    await prisma.providerService.update({ where: { id: existingService.id }, data: { adEmbedMessageId: adMessage.id } });
  });
};
