import { Client, CommandInteraction, GuildBasedChannel, Intents, MessageEmbed } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import dotenv from 'dotenv';
import { SlashCommandBuilder } from '@discordjs/builders';
import schedule from 'node-schedule';
import Guild from './guild.interface';

dotenv.config();

const cronString = '0 15 * * 5';
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
const guilds: Map<string, Guild> = new Map<string, Guild>();

schedule.scheduleJob(cronString, createPoll);

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

  guilds.get(interaction.guildId!)!.jokes.push({
    author: author.id,
    joke: joke
  });

  interaction.reply(`Joke submitted:\n\n${author}: "**${joke}**"`)
    .catch(console.error);
}

function createPoll() {
  const embed = new MessageEmbed()
    .setTitle('Vote for the Joke of the Week')
    .setDescription('React with the emoji of the joke you think was the funniest')
    .setColor('#boob69')
    .setTimestamp()
    .setThumbnail('https://cdn.discordapp.com/avatars/933319312402436206/b34986c77251abe67cf4a6909f17acc6.webp');
}
