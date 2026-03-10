# SMP Hub Discord Bot — Developer Specification

## 1) Purpose

The bot manages the full SMP Hub marketplace lifecycle:

- Provider onboarding and verification
- Service advertisements in forum channels
- Customer request tickets and delivery flow
- Deal tracking with commission accounting
- Ratings/reviews and provider reputation
- SMP partnership intake tickets
- Audit logs, transcripts, and moderation enforcement

---

## 2) Recommended Tech Stack

- **Runtime**: Node.js 20 LTS + TypeScript
- **Discord**: `discord.js` v14 (slash commands, modals, buttons, select menus, forums)
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache / limits (optional)**: Redis
- **Process management**: PM2
- **Helpers**:
  - Sharp (image handling)
  - UUID/Nanoid (identifiers)
  - Day.js/date-fns (date handling)
  - Pino/Winston (structured logging)

---

## 3) Discord Server Structure Assumptions

### Channels

- `#servicetickets` (ticket creation dropdown)
- `#service-tickets-transcripts` (transcript and event logs)
- **Forum channels**:
  - Builders
  - Developers
  - Artists
  - Editors

### Role/Permission Model

- **Verified Providers**: can create one service thread per supported service forum
- **Customers**: read forum listings + interact via tickets
- **Staff**: approve/reject providers, manage deals, moderate tickets
- **Bot**: manage channels/messages/threads, send embeds, execute workflows

---

## 4) Data Model (Prisma-style)

### `providers`

- `id: UUID`
- `discord_id: BIGINT`
- `username: VARCHAR`
- `forum_thread_id: BIGINT`
- `total_deals: INT`
- `average_rating: FLOAT`
- `rating_count: INT`
- `is_blacklisted: BOOLEAN`
- `created_at: TIMESTAMP`
- `updated_at: TIMESTAMP`

### `provider_services`

- `id: UUID`
- `provider_id: FK -> providers.id`
- `service_type: VARCHAR`
- `portfolio_link: VARCHAR`
- `starting_price: DECIMAL`
- `delivery_time_days: INT`
- `ad_embed_message_id: BIGINT`
- `created_at: TIMESTAMP`
- `updated_at: TIMESTAMP`

### `tickets`

- `id: UUID`
- `discord_channel_id: BIGINT`
- `ticket_type: VARCHAR` (`provider_registration`, `service_request`, `smp_partnership`)
- `creator_id: BIGINT`
- `assigned_staff_id: BIGINT`
- `status: VARCHAR` (`Open`, `Closed`, `Completed`)
- `created_at: TIMESTAMP`
- `updated_at: TIMESTAMP`

### `deals`

- `id: UUID`
- `ticket_id: FK -> tickets.id`
- `provider_id: FK -> providers.id`
- `customer_id: BIGINT`
- `price: DECIMAL`
- `commission: DECIMAL`
- `net_amount: DECIMAL`
- `status: VARCHAR` (`Pending`, `In Progress`, `Completed`, `Cancelled`, `Disputed`)
- `deadline: DATE`
- `created_at: TIMESTAMP`
- `updated_at: TIMESTAMP`

### `ratings`

- `id: UUID`
- `deal_id: FK -> deals.id`
- `provider_id: FK -> providers.id`
- `customer_id: BIGINT`
- `stars: INT` (1-5)
- `review_text: TEXT`
- `created_at: TIMESTAMP`

### `commission_tiers`

- `id: UUID`
- `min_earnings: DECIMAL`
- `max_earnings: DECIMAL`
- `commission_percent: DECIMAL`
- `created_at: TIMESTAMP`
- `updated_at: TIMESTAMP`

### `deal_history_logs`

- `id: UUID`
- `deal_id: FK -> deals.id`
- `action: VARCHAR`
- `actor_id: BIGINT`
- `notes: TEXT`
- `created_at: TIMESTAMP`

### `smp_partnerships`

- `id: UUID`
- `ticket_id: FK -> tickets.id`
- `server_name: VARCHAR`
- `description: TEXT`
- `member_count: INT`
- `invite_link: VARCHAR`
- `status: VARCHAR` (`Pending`, `Approved`, `Rejected`)
- `created_at: TIMESTAMP`
- `updated_at: TIMESTAMP`

---

## 5) Feature Flows

### 5.1 Ticket Creation Entry Point

In `#servicetickets`, the bot presents a dropdown with:

- Request a Service
- Register as a Service Provider
- SMP Partnership

---

### 5.2 Provider Registration Flow

1. User chooses **Register as a Service Provider**.
2. Bot opens modal fields:
   - Service Type
   - Portfolio Link
   - Starting Price
   - Delivery Time
   - Experience / Additional Info
3. Bot creates ticket channel: `provider-register-{username}`.
4. Staff review actions:
   - Approve -> verified role granted + posting permissions enabled
   - Reject -> send reason and close
   - Request changes -> keep ticket open for edits

---

### 5.3 Provider Forum Advertisement Flow

1. Verified provider opens one thread in the relevant service forum.
2. Provider posts ad content (description, pricing, portfolio, screenshots).
3. Bot captures first post and converts into standardized embed.
4. Provider ad edits are done using `/update-ad` (not direct message edits).

Embed content should include:

- Provider tag/mention
- Service type
- Verified badge/status
- Average rating + review count
- Deals completed
- Ad description
- Portfolio link
- Hiring/next-step instructions

---

### 5.4 Customer Service Request Flow

1. Customer chooses **Request a Service**.
2. Bot modal fields:
   - Service Type
   - Provider (user select)
   - Budget
   - Deadline
   - Description
3. Bot creates channel: `service-request-{username}`.
4. Bot invites provider + staff.
5. Provider sets price; once customer confirms, price is locked.

---

### 5.5 Deal Management Flow

- Provider sets deal price via `/setprice [amount]`
- Bot computes commission from `commission_tiers`
- Customer confirms -> deal transitions to **In Progress**
- Staff can close via `/complete-deal`
- All lifecycle changes logged in `deal_history_logs`

---

### 5.6 Ratings and Reviews

After completion:

1. Customer receives rating prompt (1-5 stars + optional text review)
2. Bot stores rating in `ratings`
3. Bot recalculates provider aggregate rating fields
4. Bot updates provider ad embed
5. Bot posts review snippet in provider thread

---

### 5.7 SMP Partnership Flow

1. User selects **SMP Partnership**.
2. Bot modal fields:
   - Server Name
   - Description
   - Member Count
   - Invite Link
   - Partnership Proposal
3. Bot creates ticket channel: `partnership-{server}`
4. Staff sets partnership status to Pending/Approved/Rejected

---

### 5.8 Anti-Bypass Enforcement

Policy expectation:

- Deals must remain in SMP Hub workflow
- Off-platform bypass violations can trigger:
  - provider listing removal
  - blacklist flag
  - permanent ban (staff enforcement)

---

### 5.9 Logging and Transcripts

Send ticket transcripts and major events to `#service-tickets-transcripts`:

- Ticket created/closed/reopened
- Deal price/commission/status changes
- Rating submissions
- Staff moderation actions

---

### 5.10 Slash Command Set

#### Provider

- `/update-ad`

#### Deal

- `/setprice`
- `/deal-info`
- `/dispute`

#### Staff

- `/approve-provider`
- `/reject-provider`
- `/complete-deal`
- `/cancel-deal`
- `/blacklist-provider`

#### Utility

- `/stats-provider [provider_id]`
- `/stats-server`

---

### 5.11 Event Listeners

- `threadCreate` (provider thread validation + ad bootstrap)
- `messageCreate` (first-message capture and formatting path)
- `interactionCreate` (slash commands, select menus, modals, buttons)
- `guildMemberRemove` (handle participant departure from active tickets)
- Scheduled job (monthly/periodic commission analytics)

---

### 5.12 Commission Logic

1. Read provider earning bracket from `commission_tiers`
2. Compute commission percentage from tier
3. Persist:
   - `deals.commission`
   - `deals.net_amount`
4. Append action log row to `deal_history_logs`

---

### 5.13 Lifecycle Summaries

Provider registration:

`Open registration -> Staff review -> Approved -> Role granted -> Forum posting enabled`

Customer request:

`Ticket opened -> Provider/staff joined -> Price set -> Customer confirms -> Work delivered -> Staff complete -> Rating`

Deal statuses:

`Pending -> In Progress -> Completed | Cancelled | Disputed`

---

### 5.14 Baseline Performance Targets

- Support ~200 active providers
- Sustain ~50 tickets/day
- Near-real-time ad/rating updates
- Use background jobs for heavy periodic calculations

