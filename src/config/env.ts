import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SERVICE_TICKETS_CHANNEL_ID: z.string().min(1),
  TRANSCRIPTS_CHANNEL_ID: z.string().min(1),
  VERIFIED_PROVIDER_ROLE_ID: z.string().min(1),
  STAFF_ROLE_ID: z.string().min(1),
  BUILDERS_FORUM_ID: z.string().optional(),
  DEVELOPERS_FORUM_ID: z.string().optional(),
  ARTISTS_FORUM_ID: z.string().optional(),
  EDITORS_FORUM_ID: z.string().optional()
});

export const env = envSchema.parse(process.env);
