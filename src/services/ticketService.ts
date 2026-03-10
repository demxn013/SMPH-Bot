import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { env, transcriptConfig } from '../config/env.js';
import { SERVICE_TYPES, type ServiceType } from '../constants/serviceTypes.js';
import { createTicketLogEmbed } from './embedFactory.js';
import { prisma } from './prisma.js';

const safeNumber = (value: string) => Number.parseFloat(value.replace(/[^0-9.]/g, ''));

const fetchTranscriptChannel = async (interaction: Interaction, type: 'support' | 'service' | 'partnership'): Promise<GuildTextBasedChannel | null> => {
  const transcriptId = transcriptConfig[type];
  if (!transcriptId) {
    return null;
  }
  const channel = await interaction.guild?.channels.fetch(transcriptId);
  if (!channel?.isTextBased()) {
    return null;
  }
  return channel;
};

export const createTicketEntryMenu = () => {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket-entry-select')
    .setPlaceholder('Choose a ticket type')
    .addOptions(
      { label: 'Request a Service', value: 'service_request' },
      { label: 'Register as a Service Provider', value: 'provider_registration' },
      { label: 'SMP Partnership', value: 'smp_partnership' }
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
};

export const showProviderRegistrationModal = async (interaction: StringSelectMenuInteraction) => {
  const modal = new ModalBuilder().setTitle('Provider Registration').setCustomId('provider-registration-modal');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('serviceType').setLabel('Service Type').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('portfolioLink').setLabel('Portfolio Link').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('startingPrice').setLabel('Starting Price').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('deliveryTime').setLabel('Delivery Time (days)').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('experience').setLabel('Experience / Additional Info').setStyle(TextInputStyle.Paragraph).setRequired(false)
    )
  );

  await interaction.showModal(modal);
};

export const showServiceRequestModal = async (interaction: StringSelectMenuInteraction) => {
  const modal = new ModalBuilder().setTitle('Service Request').setCustomId('service-request-modal');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('serviceType').setLabel('Service Type').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('providerId').setLabel('Provider User ID').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('budget').setLabel('Budget').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('deadline').setLabel('Deadline (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true))
  );

  await interaction.showModal(modal);
};

export const showPartnershipModal = async (interaction: StringSelectMenuInteraction) => {
  const modal = new ModalBuilder().setTitle('SMP Partnership').setCustomId('partnership-modal');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('serverName').setLabel('Server Name').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('memberCount').setLabel('Member Count').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('inviteLink').setLabel('Invite Link').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('proposal').setLabel('Partnership Proposal').setStyle(TextInputStyle.Paragraph).setRequired(true))
  );

  await interaction.showModal(modal);
};

export const handleTicketModalSubmission = async (interaction: ModalSubmitInteraction) => {
  if (!interaction.guild) {
    return;
  }

  if (interaction.customId === 'provider-registration-modal') {
    const serviceType = interaction.fields.getTextInputValue('serviceType').toLowerCase() as ServiceType;
    if (!SERVICE_TYPES.includes(serviceType)) {
      await interaction.reply({ content: `Invalid service type. Use one of: ${SERVICE_TYPES.join(', ')}`, ephemeral: true });
      return;
    }

    const channel = await interaction.guild.channels.create({
      name: `provider-register-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: env.SR_MOD_PLUS_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const ticket = await prisma.ticket.create({
      data: {
        discordChannelId: channel.id,
        ticketType: 'provider_registration',
        creatorId: interaction.user.id,
        status: 'Open'
      }
    });

    await channel.send(`Provider registration ticket created for <@${interaction.user.id}>.`);
    await prisma.provider.upsert({
      where: { discordId: interaction.user.id },
      update: { username: interaction.user.username },
      create: { discordId: interaction.user.id, username: interaction.user.username }
    });

    await prisma.providerService.create({
      data: {
        provider: { connect: { discordId: interaction.user.id } },
        serviceType,
        portfolioLink: interaction.fields.getTextInputValue('portfolioLink'),
        startingPrice: safeNumber(interaction.fields.getTextInputValue('startingPrice')),
        deliveryTimeDays: Number.parseInt(interaction.fields.getTextInputValue('deliveryTime'), 10) || 0
      }
    });

    await interaction.reply({ content: `Ticket created: <#${channel.id}>`, ephemeral: true });
    const transcript = await fetchTranscriptChannel(interaction, 'support');
    await transcript?.send({ embeds: [createTicketLogEmbed('Provider Registration Ticket Opened', `Ticket: ${ticket.id}\nUser: <@${interaction.user.id}>\nChannel: <#${channel.id}>`)] });
    return;
  }

  if (interaction.customId === 'service-request-modal') {
    const providerDiscordId = interaction.fields.getTextInputValue('providerId');
    const provider = await prisma.provider.findUnique({ where: { discordId: providerDiscordId } });
    if (!provider) {
      await interaction.reply({ content: 'Provider not registered.', ephemeral: true });
      return;
    }

    const channel = await interaction.guild.channels.create({
      name: `service-request-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: providerDiscordId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: env.SR_MOD_PLUS_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const ticket = await prisma.ticket.create({
      data: {
        discordChannelId: channel.id,
        ticketType: 'service_request',
        creatorId: interaction.user.id,
        status: 'Open'
      }
    });

    const budget = safeNumber(interaction.fields.getTextInputValue('budget'));
    await prisma.deal.create({
      data: {
        ticketId: ticket.id,
        providerId: provider.id,
        customerId: interaction.user.id,
        price: budget,
        commission: 0,
        netAmount: budget,
        status: 'Pending',
        deadline: new Date(interaction.fields.getTextInputValue('deadline'))
      }
    });

    await channel.send(`Service request opened by <@${interaction.user.id}> with provider <@${providerDiscordId}>.`);
    await interaction.reply({ content: `Ticket created: <#${channel.id}>`, ephemeral: true });
    const transcript = await fetchTranscriptChannel(interaction, 'service');
    await transcript?.send({ embeds: [createTicketLogEmbed('Service Request Opened', `Ticket: ${ticket.id}\nCustomer: <@${interaction.user.id}>\nProvider: <@${providerDiscordId}>\nChannel: <#${channel.id}>`)] });
    return;
  }

  if (interaction.customId === 'partnership-modal') {
    const serverName = interaction.fields.getTextInputValue('serverName');
    const channel = await interaction.guild.channels.create({
      name: `partnership-${serverName.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: env.SR_MOD_PLUS_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const ticket = await prisma.ticket.create({
      data: {
        discordChannelId: channel.id,
        ticketType: 'smp_partnership',
        creatorId: interaction.user.id,
        status: 'Open'
      }
    });

    await prisma.smpPartnership.create({
      data: {
        ticketId: ticket.id,
        serverName,
        description: interaction.fields.getTextInputValue('description'),
        memberCount: Number.parseInt(interaction.fields.getTextInputValue('memberCount'), 10) || 0,
        inviteLink: interaction.fields.getTextInputValue('inviteLink'),
        proposal: interaction.fields.getTextInputValue('proposal'),
        status: 'Pending'
      }
    });

    await interaction.reply({ content: `Partnership ticket created: <#${channel.id}>`, ephemeral: true });
    const transcript = await fetchTranscriptChannel(interaction, 'partnership');
    await transcript?.send({ embeds: [createTicketLogEmbed('SMP Partnership Ticket Opened', `Ticket: ${ticket.id}\nCreator: <@${interaction.user.id}>\nChannel: <#${channel.id}>`)] });
  }
};

export const sendTicketPanel = async (interaction: ChatInputCommandInteraction) => {
  await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true });
  if (interaction.channel?.isTextBased() && 'send' in interaction.channel) {
    await interaction.channel.send({
      content: 'Open a ticket using the dropdown below:',
      components: [createTicketEntryMenu()]
    });
  }
};
