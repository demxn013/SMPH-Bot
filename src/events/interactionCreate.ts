import { Events, type Client, type StringSelectMenuInteraction } from 'discord.js';
import { handleCommand } from '../services/commandService.js';
import { handleTicketModalSubmission, showPartnershipModal, showProviderRegistrationModal, showServiceRequestModal, createTicketEntryMenu } from '../services/ticketService.js';
import { prisma } from '../services/prisma.js';
import { createProviderAdEmbed, createTicketLogEmbed } from '../services/embedFactory.js';
import { parseRateModalDealId } from '../utils/customIds.js';

export const registerInteractionCreateEvent = (client: Client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ticket-panel') {
          if (interaction.channel?.isTextBased() && 'send' in interaction.channel) {
            await interaction.channel.send({ content: 'Open a ticket using the dropdown below:', components: [createTicketEntryMenu()] });
          }
          await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true });
          return;
        }
        await handleCommand(interaction);
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket-entry-select') {
        const selection = interaction.values[0];
        if (selection === 'provider_registration') {
          await showProviderRegistrationModal(interaction as StringSelectMenuInteraction);
          return;
        }
        if (selection === 'service_request') {
          await showServiceRequestModal(interaction as StringSelectMenuInteraction);
          return;
        }
        if (selection === 'smp_partnership') {
          await showPartnershipModal(interaction as StringSelectMenuInteraction);
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        const rateDealId = parseRateModalDealId(interaction.customId);
        if (rateDealId) {
          const stars = Number.parseInt(interaction.fields.getTextInputValue('stars'), 10);
          const reviewText = interaction.fields.getTextInputValue('review');
          const deal = await prisma.deal.findUnique({ where: { id: rateDealId } });
          if (!deal || stars < 1 || stars > 5) {
            await interaction.reply({ content: 'Invalid rating payload.', ephemeral: true });
            return;
          }

          await prisma.rating.create({
            data: {
              dealId: deal.id,
              providerId: deal.providerId,
              customerId: interaction.user.id,
              stars,
              reviewText
            }
          });

          const providerRatings = await prisma.rating.aggregate({
            where: { providerId: deal.providerId },
            _avg: { stars: true },
            _count: { stars: true }
          });

          const completedDealsCount = await prisma.deal.count({ where: { providerId: deal.providerId, status: 'Completed' } });
          await prisma.provider.update({
            where: { id: deal.providerId },
            data: {
              averageRating: providerRatings._avg.stars ?? 0,
              ratingCount: providerRatings._count.stars,
              totalDeals: completedDealsCount
            }
          });

          const provider = await prisma.provider.findUnique({ where: { id: deal.providerId }, include: { services: { take: 1 } } });
          if (provider?.forumThreadId && provider.services[0]?.adEmbedMessageId) {
            const thread = await interaction.guild?.channels.fetch(provider.forumThreadId);
            if (thread?.isTextBased()) {
              const message = await thread.messages.fetch(provider.services[0].adEmbedMessageId).catch(() => null);
              if (message) {
                await message.edit({
                  embeds: [
                    createProviderAdEmbed({
                      providerTag: provider.username,
                      providerId: provider.discordId,
                      serviceType: provider.services[0].serviceType as any,
                      description: message.embeds[0]?.description ?? 'Provider ad',
                      portfolioLink: provider.services[0].portfolioLink,
                      averageRating: provider.averageRating,
                      ratingCount: provider.ratingCount,
                      totalDeals: provider.totalDeals
                    })
                  ]
                });
              }

              await thread.send({ embeds: [createTicketLogEmbed('New Customer Review', `⭐ ${stars}/5\n${reviewText || '_No written review_'}\nBy: <@${interaction.user.id}>`)] });
            }
          }

          await interaction.reply({ content: 'Thanks! Your rating has been submitted.', ephemeral: true });
          return;
        }

        await handleTicketModalSubmission(interaction);
      }
    } catch (error) {
      const content = 'An error occurred while handling this interaction.';
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
      client.emit('warn', error instanceof Error ? error.message : 'Unknown interaction error');
    }
  });
};
