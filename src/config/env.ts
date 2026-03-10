import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const optionalString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return value.trim() === '' ? undefined : value;
}, z.string().optional());

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  SERVICE_TICKETS_CHANNEL_ID: z.string().min(1),
  SUPPORT_TRANSCRIPTS_CHANNEL_ID: optionalString,
  PARTNERSHIP_TRANSCRIPTS_CHANNEL_ID: optionalString,
  SERVICE_TRANSCRIPTS_CHANNEL_ID: optionalString,
  TRANSCRIPTS_CHANNEL_ID: optionalString,

  SR_MOD_PLUS_ROLE_ID: z.string().min(1),

  VERIFIED_PROVIDER_ROLE_ID: z.string().min(1),
  PROVIDER_DEVELOPER_ROLE_ID: optionalString,
  PROVIDER_ARTIST_ROLE_ID: optionalString,
  PROVIDER_EDITOR_ROLE_ID: optionalString,
  PROVIDER_BUILDER_ROLE_ID: optionalString,

  CODING_FORUM_ID: optionalString,
  EDITING_FORUM_ID: optionalString,
  BOSSES_FORUM_ID: optionalString,
  LOGOS_FORUM_ID: optionalString,
  SKINS_FORUM_ID: optionalString,
  BUILDING_FORUM_ID: optionalString,
  TEXTURES_FORUM_ID: optionalString,
  THUMBNAILS_FORUM_ID: optionalString
});

export const env = envSchema.parse(process.env);

export const transcriptConfig = {
  support: env.SUPPORT_TRANSCRIPTS_CHANNEL_ID ?? env.TRANSCRIPTS_CHANNEL_ID,
  service: env.SERVICE_TRANSCRIPTS_CHANNEL_ID ?? env.TRANSCRIPTS_CHANNEL_ID,
  partnership: env.PARTNERSHIP_TRANSCRIPTS_CHANNEL_ID ?? env.TRANSCRIPTS_CHANNEL_ID
};
