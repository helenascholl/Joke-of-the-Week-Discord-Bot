import { Client, CommandInteraction, Intents } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import dotenv from 'dotenv';
import Joke from './joke.interface';
import { SlashCommandBuilder } from '@discordjs/builders';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a joke')
    .addUserOption(o => o.setName('author').setDescription('The author of the joke').setRequired(true))
    .addStringOption(o => o.setName('joke').setDescription('The joke to submit').setRequired(true))
];
const token = process.env['NODE_ENV'] === 'development' ?
  process.env['DISCORD_DEV_TOKEN']! :
  process.env['DISCORD_PROD_TOKEN']!;
const rest = new REST({ version: '9' }).setToken(token);
const client = new Client({ intents: [ Intents.FLAGS.GUILDS ] });
const jokes: Map<string, Joke[]> = new Map<string, Joke[]>();

client.on('ready', client => {
  console.log(`Logged in as ${client.user.tag}`);

  client.guilds.cache.forEach(guild => {
    rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands })
      .catch(console.error);
  });
});

client.on('interactionCreate', interaction => {
  if (interaction.isCommand()) {
    switch (interaction.commandName) {
      case 'submit':
        submit(interaction);
        break;
    }
  }
});

client.login(token)
  .catch(console.error);

function submit(interaction: CommandInteraction) {
  if (!jokes.has(interaction.guildId!)) {
    jokes.set(interaction.guildId!, []);
  }

  const author = interaction.options.getUser('author')!;
  const joke = interaction.options.getString('joke')!;

  jokes.get(interaction.guildId!)!.push({
    author: author.id,
    joke: joke
  });

  interaction.reply(`Joke submitted:\n\n${author}: "**${joke}**"`)
    .catch(console.error);
}
