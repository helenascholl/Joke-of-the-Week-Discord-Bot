# Your Bot

A Discord bot.

## Invite the bot

https://discordapp.com/oauth2/authorize?&client_id=[CLIENT ID]&scope=bot&permissions=[PERMISSIONS]

## For Developers

### Create a Discord Application

If you want to run the bot yourself, [create a new Discord Bot](https://discordapp.com/developers/docs/intro#bots-and-apps).
Then make a copy of `template.env` and call it `.env` and copy your token into this file. In most cases using the same
token as `DISCORD_DEV_TOKEN` and `DISCORD_PROD_TOKEN` should be sufficient. However, if you want to work on the bot
while an instance is running, you should create a second bot and use it's token as `DISCORD_ENV_TOKEN`.

### Get your invite link

To create an invite link for your bot, replace `[CLIENT ID]` in the link above with the Client ID of your Discord
Application and `[PERMISSIONS]` with the generated integer.

### Start the Bot

#### Development

```shell
npm install
npm run start:dev
```

#### Production

```shell
docker-compose up -d
```

### CI/CD

You can set up a GitHub Actions Workflow by copying the [ci.yml](https://github.com/schollsebastian/CI-Test-Bot/blob/main/.github/workflows/ci.yml)
file into the `.github/workflows` directory of your repository.
