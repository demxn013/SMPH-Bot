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

## Docs

- `docs/smp-hub-bot-spec.md` — full functional specification for the Discord bot
- `docs/smp-hub-diagrams.md` — ERD and ticket/deal flow diagrams (Mermaid)
