import { DiscordAPIError, REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { commandDefinitions } from '../services/commandService.js';

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

try {
  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body: commandDefinitions
  });

  console.log(`Registered ${commandDefinitions.length} guild commands.`);
} catch (error) {
  if (error instanceof DiscordAPIError && error.code === 50001) {
    console.error('Failed to register commands: Discord returned 50001 (Missing Access).');
    console.error('Verify the following before re-running:');
    console.error(`- DISCORD_CLIENT_ID (${env.DISCORD_CLIENT_ID}) is the same application as the bot token.`);
    console.error(`- DISCORD_GUILD_ID (${env.DISCORD_GUILD_ID}) is a guild where the bot is present.`);
    console.error('- The bot was invited with the "applications.commands" scope.');
    console.error('- You have permission to manage that application/guild setup.');
    process.exit(1);
  }

  throw error;
}
