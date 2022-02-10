import {
  Client,
  Collection,
  CommandInteraction,
  GuildTextBasedChannel,
  Intents,
  Message,
  MessageEmbed,
  MessageReaction
} from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import dotenv from 'dotenv';
import { SlashCommandBuilder } from '@discordjs/builders';
import schedule from 'node-schedule';
import fs from 'fs/promises';
import Guild from './guild.interface';
import Joke from './joke.interface';

dotenv.config();

const cronString = '0 15 * * 5';
const emojis = [ '😆', '😍', '😎', '😡', '😑', '🤢', '🥵', '🥶', '💩', '🤡', '🤩', '😈', '🤠', '🥳' ];
const embedColor = '#b00b69';
const embedThumbnail = 'https://cdn.discordapp.com/avatars/933319312402436206/b34986c77251abe67cf4a6909f17acc6.webp';
const pollTime = 10 * 60 * 1000;
const guildsFile = 'src/guilds.json';
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
let guilds: Map<string, Guild> = new Map<string, Guild>();

schedule.scheduleJob(cronString, createPoll);

client.on('ready', async client => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity({  type: 'LISTENING', name: '/submit' });

  rest.put(Routes.applicationCommands(client.user.id), { body: commands })
    .catch(console.error);

  guilds = await readPersistedGuilds();
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

function submit(interaction: CommandInteraction): void {
  if (guilds.has(interaction.guildId!)) {
    if (guilds.get(interaction.guildId!)!.jokes.length < emojis.length) {
      const author = interaction.options.getUser('author')!;
      const joke = interaction.options.getString('joke')!;

      guilds.get(interaction.guildId!)!.jokes.push({
        author: {
          id: author.id,
          username: author.username
        },
        joke: joke
      });

      persistGuilds();

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

function channel(interaction: CommandInteraction): void {
  const channel = interaction.options.getChannel('channel')!;

  if (channel.type === 'GUILD_TEXT') {
    if (!guilds.has(interaction.guildId!)) {
      guilds.set(interaction.guildId!, { id: interaction.guildId!, channel: channel.id, jokes: [] });
    } else {
      guilds.get(interaction.guildId!)!.channel = channel.id;
    }

    persistGuilds();

    interaction.reply(`Polls will now be posted in ${channel}`)
      .catch(console.error);
  } else {
    interaction.reply({ content: `**${channel}** is not a text channel`, ephemeral: true })
      .catch(console.error);
  }
}

function createPoll(): void {
  const embed = new MessageEmbed()
    .setTitle('Vote for the Joke of the Week')
    .setDescription('React with the emoji of the joke you think was the funniest.')
    .setColor(embedColor)
    .setTimestamp()
    .setThumbnail(embedThumbnail);

  guilds.forEach(guild => {
    const channel = client.channels.cache.get(guild.channel) as GuildTextBasedChannel;

    const options: Map<string, Joke> = new Map<string, Joke>();

    guild.jokes.forEach((joke, i) => {
      embed.addField(`${emojis[i]} ${joke.author.username}`, joke.joke);
      options.set(emojis[i], joke);
    });
    guild.jokes = [];

    channel.send({ embeds: [ embed ] })
      .then(async message => {
        const emojis = Array.from(options.keys());

        awaitReactions(message, emojis)
          .then(result => {
            const embed = new MessageEmbed()
              .setTitle('🎉 The Joke of the Week!')
              .setColor(embedColor)
              .setTimestamp()
              .setThumbnail(embedThumbnail);

            result.forEach(r => {
              embed.addField(`${r.votes} votes`,
                `${r.emoji} ${options.get(r.emoji)!.joke} - ${options.get(r.emoji)!.author.username}`);
            });

            message.channel.send({ embeds: [ embed ] })
              .catch(console.error);
          });

        for (const emoji of emojis) {
          await message.react(emoji);
        }
      })
      .catch(console.error);
  });

  persistGuilds();
}

function awaitReactions(message: Message, emojis: string[]): Promise<{ emoji: string; votes: number }[]> {
  return new Promise(resolve => {
    message.awaitReactions({ filter: r => emojis.includes(r.emoji.name!), time: pollTime, errors: [ 'time' ] })
      .catch((collected: Collection<string, MessageReaction>) => {
        const users: string[] = [];
        const result = new Map<string, number>();

        collected.forEach(reaction => {
          if (!result.has(reaction.emoji.name!)) {
            result.set(reaction.emoji.name!, 0);
          }

          reaction.users.cache.forEach(user => {
            if (user.id !== client.user!.id && !users.includes(user.id)) {
              users.push(user.id);
              result.set(reaction.emoji.name!, result.get(reaction.emoji.name!)! + 1);
            }
          });
        });

        const sortedResult: { emoji: string; votes: number }[] = [];

        result.forEach((votes, emoji) => {
          sortedResult.push({ emoji, votes });
        });

        resolve(sortedResult.sort((a, b) => b.votes - a.votes));
      });
  });
}

async function readPersistedGuilds(): Promise<Map<string, Guild>> {
  const guilds = new Map<string, Guild>();

  try {
    const guildJson = JSON.parse(await fs.readFile('src/guilds.json', 'utf-8')) as { [ key: string ]: Guild };

    for (const key in guildJson) {
      guilds.set(key, guildJson[key]);
    }
  } catch {
    console.log('No persisted guilds found');
  }

  return guilds;
}

function persistGuilds(): void {
  const guildJson: { [ key: string ]: Guild } = {};

  for (const key of guilds.keys()) {
    guildJson[key] = guilds.get(key)!;
  }

  fs.writeFile(guildsFile, JSON.stringify(guildJson, null, 2))
    .catch(console.error);
}
