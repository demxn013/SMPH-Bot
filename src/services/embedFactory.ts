import { EmbedBuilder } from 'discord.js';
import type { ServiceType } from '../constants/serviceTypes.js';

export const createProviderAdEmbed = (params: {
  providerTag: string;
  providerId: string;
  serviceType: ServiceType;
  description: string;
  portfolioLink: string;
  averageRating: number;
  ratingCount: number;
  totalDeals: number;
}) => {
  return new EmbedBuilder()
    .setTitle(`🛒 ${params.providerTag} — ${params.serviceType.toUpperCase()} Services`)
    .setDescription(params.description)
    .addFields(
      { name: 'Provider', value: `<@${params.providerId}>`, inline: true },
      { name: 'Verified', value: '✅ Yes', inline: true },
      { name: 'Portfolio', value: params.portfolioLink, inline: false },
      {
        name: 'Reputation',
        value: `⭐ ${params.averageRating.toFixed(2)} (${params.ratingCount} reviews)\n✅ ${params.totalDeals} completed deals`,
        inline: false
      },
      { name: 'How to Hire', value: 'Use the ticket menu in #servicetickets and choose this provider.', inline: false }
    )
    .setColor(0x00b894)
    .setTimestamp();
};

export const createTicketLogEmbed = (title: string, details: string) =>
  new EmbedBuilder().setTitle(title).setDescription(details).setColor(0x5865f2).setTimestamp();
