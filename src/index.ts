import { Client, CommandInteraction, GuildTextBasedChannel, Intents, MessageEmbed } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import dotenv from 'dotenv';
import { SlashCommandBuilder } from '@discordjs/builders';
import schedule from 'node-schedule';
import Guild from './guild.interface';
import Joke from './joke.interface';

dotenv.config();

const cronString = '0 15 * * 5';
const emojis = [ '😆', '😍', '😎', '😡', '😑', '🤢', '🥵', '🥶', '💩', '🤡', '🤩', '😈', '🤠', '🥳' ];
const embedColor = '#b00b69';
const embedThumbnail = 'https://cdn.discordapp.com/avatars/933319312402436206/b34986c77251abe67cf4a6909f17acc6.webp';
const commands = [
  new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a joke')
    .addUserOption(o => o.setName('author').setDescription('The author of the joke').setRequired(true))
    .addStringOption(o => o.setName('joke').setDescription('The joke to submit').setRequired(true)),
  new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Set the channel for polls')
    .addChannelOption(o => o.setName('channel').setDescription('The channel').setRequired(true))
];
const token = process.env['NODE_ENV'] === 'development' ?
  process.env['DISCORD_DEV_TOKEN']! :
  process.env['DISCORD_PROD_TOKEN']!;
const rest = new REST({ version: '9' }).setToken(token);
const client = new Client({ intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS ] });
const guilds: Map<string, Guild> = new Map<string, Guild>();
const votes: Map<string, Map<string, Joke>> = new Map<string, Map<string, Joke>>();

schedule.scheduleJob(cronString, createPoll);

client.on('ready', client => {
  console.log(`Logged in as ${client.user.tag}`);

  rest.put(Routes.applicationCommands(client.user.id), { body: commands })
    .catch(console.error);
});

client.on('interactionCreate', interaction => {
  if (interaction.isCommand()) {
    switch (interaction.commandName) {
      case 'submit':
        submit(interaction);
        break;

      case 'channel':
        channel(interaction);
        break;
    }
  }
});

client.login(token)
  .catch(console.error);

function submit(interaction: CommandInteraction) {
  if (guilds.has(interaction.guildId!)) {
    if (guilds.get(interaction.guildId!)!.jokes.length < emojis.length) {
      const author = interaction.options.getUser('author')!;
      const joke = interaction.options.getString('joke')!;

      guilds.get(interaction.guildId!)!.jokes.push({
        author: author.id,
        joke: joke
      });

      const embed = new MessageEmbed()
        .setTitle('🥳 Joke submitted')
        .addField(author.username, joke)
        .setColor(embedColor)
        .setTimestamp()
        .setThumbnail(embedThumbnail);
      interaction.reply({ embeds: [ embed ] })
        .catch(console.error);
    } else {
      interaction.reply({ content: 'Maximum number of jokes reached this week', ephemeral: true })
        .catch(console.error);
    }
  } else {
    interaction.reply({
      content: 'Please specify the poll channel with `/channel channel: #polls` first',
      ephemeral: true
    })
      .catch(console.error);
  }
}

function channel(interaction: CommandInteraction) {
  const channel = interaction.options.getChannel('channel')!;

  if (channel.type === 'GUILD_TEXT') {
    if (!guilds.has(interaction.guildId!)) {
      guilds.set(interaction.guildId!, { id: interaction.guildId!, channel: channel.id, jokes: [] });
    } else {
      guilds.get(interaction.guildId!)!.channel = channel.id;
    }

    interaction.reply(`Polls will now be posted in ${channel}`)
      .catch(console.error);
  } else {
    interaction.reply({ content: `**${channel}** is not a text channel`, ephemeral: true })
      .catch(console.error);
  }
}

function createPoll() {
  const embed = new MessageEmbed()
    .setTitle('Vote for the Joke of the Week')
    .setDescription('React with the emoji of the joke you think was the funniest.')
    .setColor(embedColor)
    .setTimestamp()
    .setThumbnail(embedThumbnail);

  guilds.forEach(guild => {
    const channel = client.channels.cache.get(guild.channel) as GuildTextBasedChannel;

    votes.set(guild.id, new Map<string, Joke>());

    guild.jokes.forEach((joke, i) => {
      embed.addField(`${emojis[i]} ${client.users.cache.get(joke.author)!.username}`, joke.joke);
      votes.get(guild.id)!.set(emojis[i], joke);
    });
    guild.jokes = [];

    channel.send({ embeds: [ embed ] })
      .then(message => {
        const emojis = Array.from(votes.get(guild.id)!.keys());

        for (let i = 0; i <= emojis.length; i++) {
          message.react(emojis[i])
            .catch(console.error);
        }
      })
      .catch(console.error);
  });
}
