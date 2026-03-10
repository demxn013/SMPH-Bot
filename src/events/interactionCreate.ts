import { DiscordAPIError, Events, MessageFlags, type Client, type StringSelectMenuInteraction } from 'discord.js';
import { handleCommand } from '../services/commandService.js';
import {
  createPartnershipTypeMenu,
  createServiceTicketTypeMenu,
  handleTicketModalSubmission,
  postTicketPanelByType,
  showPartnershipModal,
  showProviderRegistrationModal,
  showServiceRequestModal,
  showSupportModal
} from '../services/ticketService.js';
import { prisma } from '../services/prisma.js';
import { createProviderAdEmbed, createTicketLogEmbed } from '../services/embedFactory.js';
import { parseRateModalDealId } from '../utils/customIds.js';

export const registerInteractionCreateEvent = (client: Client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      console.log(`[interaction] type=${interaction.type} user=${interaction.user?.tag ?? 'unknown'} id=${interaction.id}`);

      if (interaction.isChatInputCommand()) {
        console.log(`[interaction] chat command: /${interaction.commandName}`);
        if (interaction.commandName === 'ticket-panel') {
          const type = interaction.options.getString('type', true) as 'service' | 'support' | 'partner';
          await postTicketPanelByType(interaction, type);
          return;
        }

        await handleCommand(interaction);
        return;
      }

      if (interaction.isButton()) {
        console.log(`[interaction] button: ${interaction.customId}`);
        if (interaction.customId === 'open-support-ticket') {
          await showSupportModal(interaction);
          return;
        }

        await interaction.reply({
          content: 'Unknown button interaction. Please use the latest ticket panel message and try again.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.isStringSelectMenu()) {
        console.log(`[interaction] select menu: ${interaction.customId} value=${interaction.values[0] ?? 'none'}`);

        if (interaction.customId === 'ticket-entry-select') {
          const selection = interaction.values[0];
          if (selection === 'service_tickets') {
            await interaction.reply({ content: 'Choose the service ticket type:', components: [createServiceTicketTypeMenu()], flags: MessageFlags.Ephemeral });
            return;
          }

          if (selection === 'partner_tickets') {
            await interaction.reply({ content: 'Choose the partnership type:', components: [createPartnershipTypeMenu()], flags: MessageFlags.Ephemeral });
            return;
          }

          if (selection === 'support_ticket') {
            await showSupportModal(interaction as StringSelectMenuInteraction);
            return;
          }

          await interaction.reply({ content: 'Unknown ticket option selected. Please try again and choose a listed option.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (interaction.customId === 'service-ticket-type-select') {
          const selection = interaction.values[0];
          if (selection === 'provider_registration') {
            await showProviderRegistrationModal(interaction as StringSelectMenuInteraction);
            return;
          }

          if (selection === 'service_request') {
            await showServiceRequestModal(interaction as StringSelectMenuInteraction);
            return;
          }

          await interaction.reply({ content: 'Unknown service ticket type selected. Please try again.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (interaction.customId === 'partnership-ticket-type-select') {
          const selection = interaction.values[0];
          if (selection === 'basic' || selection === 'paid') {
            await showPartnershipModal(interaction as StringSelectMenuInteraction, selection);
            return;
          }

          await interaction.reply({ content: 'Unknown partnership type selected. Please choose basic or paid.', flags: MessageFlags.Ephemeral });
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        console.log(`[interaction] modal submit: ${interaction.customId}`);
        const rateDealId = parseRateModalDealId(interaction.customId);
        if (rateDealId) {
          const stars = Number.parseInt(interaction.fields.getTextInputValue('stars'), 10);
          const reviewText = interaction.fields.getTextInputValue('review');
          const deal = await prisma.deal.findUnique({ where: { id: rateDealId } });
          if (!deal || stars < 1 || stars > 5) {
            await interaction.reply({ content: 'Invalid rating payload.', flags: MessageFlags.Ephemeral });
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

          await interaction.reply({ content: 'Thanks! Your rating has been submitted.', flags: MessageFlags.Ephemeral });
          return;
        }

        await handleTicketModalSubmission(interaction);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : 'Unknown interaction error';
      console.error(`[interaction] error for id=${interaction.id}: ${errorMessage}`);

      if (error instanceof DiscordAPIError && error.code === 40060) {
        console.warn(`[interaction] interaction ${interaction.id} was already acknowledged; skipping second response.`);
        client.emit('warn', error instanceof Error ? error.message : 'Unknown interaction error');
        return;
      }

      let content = 'An error occurred while handling this interaction.';
      if (error instanceof DiscordAPIError && error.code === 50013) {
        content = 'Discord says I am missing permissions for this action. Please check my role/channel permissions (Send Messages, View Channel, Manage Channels) and try again.';
      } else if (error instanceof DiscordAPIError && error.code === 50001) {
        content = 'Discord says I am missing access. Please check that I am in the server/channel and invited with the correct scopes.';
      }

      if (interaction.isRepliable()) {
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
          }
        } catch (responseError) {
          if (responseError instanceof DiscordAPIError && responseError.code === 40060) {
            console.warn(`[interaction] response for ${interaction.id} was already acknowledged while handling an error.`);
          } else {
            throw responseError;
          }
        }
      }

      client.emit('warn', error instanceof Error ? error.message : 'Unknown interaction error');
    }
  });
};
