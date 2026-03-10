# SMP-Hub

SMP Hub Discord marketplace bot implementation based on the docs in `docs/`.

## Included

- Ticket dropdown panel (`Request a Service`, `Register as Provider`, `SMP Partnership`)
- Modal-driven ticket creation and DB persistence
- Provider ad thread conversion into standardized embeds
- Slash commands for provider/staff/deal/stats workflows
- Deal commission calculation from `commission_tiers`
- Deal history logging, rating capture, and provider stat recalculation
- Anti-bypass phrase monitoring to transcript channel

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   cp .env.example .env
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Register slash commands in your guild:
   ```bash
   npm run register:commands
   ```
5. Start the bot:
   ```bash
   npm run dev
   ```


## Environment variable guide

`DISCORD_CLIENT_ID` = your Discord application ID (from the Discord Developer Portal -> your bot application -> **General Information** -> **Application ID**).

### Transcript channels

Set all three so logs are split by workflow:

- `SUPPORT_TRANSCRIPTS_CHANNEL_ID` — general support/provider registration transcript logs
- `PARTNERSHIP_TRANSCRIPTS_CHANNEL_ID` — SMP partnership transcript logs
- `SERVICE_TRANSCRIPTS_CHANNEL_ID` — service request/deal transcript logs

`TRANSCRIPTS_CHANNEL_ID` is kept only as a fallback for older setups.

### Staff role for service moderation

- `SR_MOD_PLUS_ROLE_ID` — only this role (and higher roles with equivalent perms) is added to service/provider/partnership ticket channels by the bot.

### Provider roles

- `VERIFIED_PROVIDER_ROLE_ID` — unified verified provider role
- `PROVIDER_DEVELOPER_ROLE_ID` — developers (coding + bosses)
- `PROVIDER_ARTIST_ROLE_ID` — artists (textures + thumbnails + skins + logos)
- `PROVIDER_EDITOR_ROLE_ID` — editors (video editing)
- `PROVIDER_BUILDER_ROLE_ID` — builders (building services)

### Forum channel IDs

- `CODING_FORUM_ID`
- `EDITING_FORUM_ID`
- `BOSSES_FORUM_ID`
- `LOGOS_FORUM_ID`
- `SKINS_FORUM_ID`
- `BUILDING_FORUM_ID`
- `TEXTURES_FORUM_ID`
- `THUMBNAILS_FORUM_ID`

## Command reference

### Project / terminal commands

- `npm install` — installs all dependencies from `package.json`.
- `npm run dev` — runs the bot in development mode with `tsx watch`.
- `npm run build` — compiles TypeScript from `src/` into `dist/`.
- `npm start` — starts the compiled bot from `dist/index.js`.
- `npm run register:commands` — registers guild slash commands using your configured Discord app and guild IDs.
- `npm run prisma:generate` — generates the Prisma client from `prisma/schema.prisma`.

### Discord slash commands

#### Provider commands

- `/update-ad` — updates your provider forum ad embed content and portfolio link.

#### Deal commands

- `/setprice` — sets the active ticket deal price and calculates commission/net amount from commission tiers.
- `/deal-info` — shows the current deal status, price, commission, and net amount.
- `/dispute` — marks the current deal as disputed.

#### Staff commands

- `/approve-provider` — approves a provider registration ticket and assigns the verified provider role.
- `/reject-provider` — rejects an open provider registration ticket.
- `/complete-deal` — marks the current deal as completed and triggers the customer rating flow.
- `/cancel-deal` — marks the current deal as cancelled.
- `/blacklist-provider` — marks a provider as blacklisted in the database.

#### Utility/admin commands

- `/stats-provider` — displays stats for a selected provider (deals, rating, blacklist status).
- `/stats-server` — displays marketplace-wide stats (providers, open tickets, completed deals, commissions).
- `/ticket-panel` — posts the ticket dropdown panel message in the current channel.

## Docs

- `docs/smp-hub-bot-spec.md` — full functional specification for the Discord bot
- `docs/smp-hub-diagrams.md` — ERD and ticket/deal flow diagrams (Mermaid)
