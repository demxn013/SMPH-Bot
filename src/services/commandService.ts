import {
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction
} from 'discord.js';
import { prisma } from './prisma.js';
import { calculateCommission } from './commissionService.js';
import { createProviderAdEmbed } from './embedFactory.js';
import { env } from '../config/env.js';

const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket management commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('panel')
      .setDescription('Post a ticket panel embed in this channel')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Which ticket panel to post')
          .setRequired(true)
          .addChoices(
            { name: 'Service', value: 'service' },
            { name: 'Support', value: 'support' },
            { name: 'Partner', value: 'partner' }
          )
      )
  );

export const commandDefinitions = [
  ticketCommand,
  new SlashCommandBuilder()
    .setName('update-ad')
    .setDescription('Update your forum ad embed')
    .addStringOption((o) => o.setName('description').setDescription('Ad description').setRequired(true))
    .addStringOption((o) => o.setName('portfolio').setDescription('Portfolio URL').setRequired(true)),
  new SlashCommandBuilder().setName('setprice').setDescription('Set the deal price').addNumberOption((o) => o.setName('amount').setDescription('Deal amount').setRequired(true)),
  new SlashCommandBuilder().setName('deal-info').setDescription('Show deal info for this ticket'),
  new SlashCommandBuilder().setName('dispute').setDescription('Mark current deal as disputed'),
  new SlashCommandBuilder().setName('approve-provider').setDescription('Approve provider in this registration ticket').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('reject-provider').setDescription('Reject provider in this registration ticket').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('complete-deal').setDescription('Complete current deal and request rating').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('cancel-deal').setDescription('Cancel current deal').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('blacklist-provider')
    .setDescription('Blacklist provider')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('Provider').setRequired(true)),
  new SlashCommandBuilder().setName('stats-server').setDescription('Marketplace statistics'),
  new SlashCommandBuilder()
    .setName('stats-provider')
    .setDescription('Provider statistics')
    .addUserOption((o) => o.setName('user').setDescription('Provider user').setRequired(true))
].map((x) => x.toJSON());

const getTicketWithDeal = async (channelId: string) =>
  prisma.ticket.findFirst({ where: { discordChannelId: channelId, status: 'Open' }, include: { deals: { orderBy: { createdAt: 'desc' }, take: 1 } } });

export const handleCommand = async (interaction: ChatInputCommandInteraction) => {
  const { commandName } = interaction;

  if (commandName === 'update-ad') {
    const description = interaction.options.getString('description', true);
    const portfolio = interaction.options.getString('portfolio', true);
    const provider = await prisma.provider.findUnique({ where: { discordId: interaction.user.id } });
    const service = provider ? await prisma.providerService.findFirst({ where: { providerId: provider.id }, orderBy: { createdAt: 'asc' } }) : null;
    if (!provider || !service || !service.adEmbedMessageId) {
      await interaction.reply({ content: 'No ad record found for your account.', ephemeral: true });
      return;
    }

    const thread = await interaction.guild?.channels.fetch(provider.forumThreadId ?? '');
    if (!thread?.isTextBased()) {
      await interaction.reply({ content: 'Unable to find your ad thread.', ephemeral: true });
      return;
    }

    const message = await thread.messages.fetch(service.adEmbedMessageId);
    await message.edit({
      embeds: [
        createProviderAdEmbed({
          providerTag: interaction.user.tag,
          providerId: interaction.user.id,
          serviceType: service.serviceType as any,
          description,
          portfolioLink: portfolio,
          averageRating: provider.averageRating,
          ratingCount: provider.ratingCount,
          totalDeals: provider.totalDeals
        })
      ]
    });

    await interaction.reply({ content: 'Ad updated.', ephemeral: true });
    return;
  }

  if (commandName === 'setprice') {
    const amount = interaction.options.getNumber('amount', true);
    const ticket = await getTicketWithDeal(interaction.channelId);
    if (!ticket || ticket.ticketType !== 'service_request' || !ticket.deals[0]) {
      await interaction.reply({ content: 'No active service deal in this channel.', ephemeral: true });
      return;
    }

    const deal = ticket.deals[0];
    const commissionData = await calculateCommission(deal.providerId, amount);
    await prisma.deal.update({
      where: { id: deal.id },
      data: { price: amount, commission: commissionData.commission, netAmount: commissionData.netAmount, status: 'In Progress' }
    });

    await prisma.dealHistoryLog.create({
      data: { dealId: deal.id, action: 'set_price', actorId: interaction.user.id, notes: `Price ${amount} | ${commissionData.percent}% commission` }
    });

    await interaction.reply(`Price set to $${amount.toFixed(2)}. Commission: $${commissionData.commission.toFixed(2)} (${commissionData.percent}%).`);
    return;
  }

  if (commandName === 'deal-info') {
    const ticket = await getTicketWithDeal(interaction.channelId);
    const deal = ticket?.deals[0];
    if (!deal) {
      await interaction.reply({ content: 'No deal found in this channel.', ephemeral: true });
      return;
    }
    await interaction.reply(`Deal status: **${deal.status}**\nPrice: **$${Number(deal.price).toFixed(2)}**\nCommission: **$${Number(deal.commission).toFixed(2)}**\nNet: **$${Number(deal.netAmount).toFixed(2)}**`);
    return;
  }

  if (commandName === 'dispute' || commandName === 'cancel-deal') {
    const ticket = await getTicketWithDeal(interaction.channelId);
    const deal = ticket?.deals[0];
    if (!deal) {
      await interaction.reply({ content: 'No deal found in this channel.', ephemeral: true });
      return;
    }

    const status = commandName === 'dispute' ? 'Disputed' : 'Cancelled';
    await prisma.deal.update({ where: { id: deal.id }, data: { status } });
    await prisma.dealHistoryLog.create({ data: { dealId: deal.id, action: status.toLowerCase(), actorId: interaction.user.id, notes: `${status} via command` } });
    await interaction.reply(`Deal marked as **${status}**.`);
    return;
  }

  if (commandName === 'complete-deal') {
    const ticket = await getTicketWithDeal(interaction.channelId);
    const deal = ticket?.deals[0];
    if (!deal) {
      await interaction.reply({ content: 'No deal found in this channel.', ephemeral: true });
      return;
    }

    await prisma.deal.update({ where: { id: deal.id }, data: { status: 'Completed' } });
    await prisma.ticket.update({ where: { id: ticket!.id }, data: { status: 'Completed' } });
    await prisma.dealHistoryLog.create({ data: { dealId: deal.id, action: 'completed', actorId: interaction.user.id, notes: 'Completed by staff' } });

    const rateModal = new ModalBuilder().setCustomId(`rate-deal-modal:${deal.id}`).setTitle('Rate your provider');
    rateModal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('stars').setLabel('Stars (1-5)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('review').setLabel('Review (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false))
    );

    const customerMember = await interaction.guild?.members.fetch(deal.customerId).catch(() => null);
    if (customerMember) {
      await interaction.reply(`Deal completed. <@${deal.customerId}> please run "/deal-info" if you need details. Sending rating prompt via DM.`);
      const dm = await customerMember.createDM();
      await dm.send('Your SMP Hub deal is complete. Please use the attached modal to rate the provider.');
      await interaction.followUp({ content: 'Unable to present modal in DM automatically. Ask the customer to use /rate command in channel if needed.', ephemeral: true });
    } else {
      await interaction.reply('Deal completed, but customer is unavailable for rating prompt.');
    }
    return;
  }

  if (commandName === 'approve-provider' || commandName === 'reject-provider') {
    const ticket = await prisma.ticket.findFirst({ where: { discordChannelId: interaction.channelId, ticketType: 'provider_registration', status: 'Open' } });
    if (!ticket) {
      await interaction.reply({ content: 'No open provider registration ticket in this channel.', ephemeral: true });
      return;
    }

    const action = commandName === 'approve-provider' ? 'Approved' : 'Rejected';
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: commandName === 'approve-provider' ? 'Completed' : 'Closed', assignedStaffId: interaction.user.id } });

    if (commandName === 'approve-provider') {
      const member = await interaction.guild?.members.fetch(ticket.creatorId);
      await member?.roles.add(env.VERIFIED_PROVIDER_ROLE_ID);
    }

    await interaction.reply(`Provider registration ${action.toLowerCase()}.`);
    return;
  }

  if (commandName === 'blacklist-provider') {
    const user = interaction.options.getUser('user', true);
    await prisma.provider.updateMany({ where: { discordId: user.id }, data: { isBlacklisted: true } });
    await interaction.reply(`${user.tag} has been blacklisted.`);
    return;
  }

  if (commandName === 'stats-provider') {
    const user = interaction.options.getUser('user', true);
    const provider = await prisma.provider.findUnique({ where: { discordId: user.id } });
    if (!provider) {
      await interaction.reply({ content: 'Provider not found.', ephemeral: true });
      return;
    }

    await interaction.reply(`Provider stats for ${user.tag}\nDeals: ${provider.totalDeals}\nRating: ${provider.averageRating.toFixed(2)} (${provider.ratingCount})\nBlacklisted: ${provider.isBlacklisted ? 'Yes' : 'No'}`);
    return;
  }

  if (commandName === 'stats-server') {
    const [providerCount, openTickets, completedDeals, totalCommission] = await Promise.all([
      prisma.provider.count(),
      prisma.ticket.count({ where: { status: 'Open' } }),
      prisma.deal.count({ where: { status: 'Completed' } }),
      prisma.deal.aggregate({ _sum: { commission: true } })
    ]);

    await interaction.reply(`SMP Hub stats\nProviders: ${providerCount}\nOpen tickets: ${openTickets}\nCompleted deals: ${completedDeals}\nCommission earned: $${Number(totalCommission._sum.commission ?? 0).toFixed(2)}`);
    return;
  }

  if (commandName === 'ticket-panel') {
    if (interaction.channel?.isTextBased() && 'send' in interaction.channel) {
      await interaction.channel.send({ content: 'Use the dropdown below to open a ticket.' });
    }
    await interaction.reply({ content: 'Ticket panel helper message posted. Use /setup-ticket-panel for full panel.', ephemeral: true });
  }
};
