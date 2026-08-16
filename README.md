# Discord Verification Bot

A Discord bot with a customizable verification panel and button-entry giveaways. Verification safely assigns one configured role and can write events to a log channel. Giveaway entries and configuration persist across restarts.

## Requirements

- Node.js 20 or newer
- A Discord application and bot
- A server where you can manage roles and invite apps

## Setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), create an application, and add a bot.
2. On the application's **Installation** page, configure a server install with the `bot` and `applications.commands` scopes. Give the bot these permissions:
   - Manage Roles
   - View Channels
   - Send Messages
   - Embed Links
3. Install the bot into your server.
4. In **Server Settings → Roles**, create a member role such as `Verified`. Move the bot's role **above** that role. Do not give the verified role Administrator.
5. Copy the application ID from the Developer Portal.
6. Install and configure the bot:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

7. Edit `.env` with the bot token and application ID.
8. Start the bot:

   ```powershell
   npm start
   ```

   On Windows, you can also double-click [`run-bot.bat`](run-bot.bat) to start it.

## Sparked Host Apollo setup

Upload the whole project, including `package.json`, `package-lock.json`, `index.js`, `src/`, and `.env`. In Apollo **Startup**, use:

- **Startup File:** `index.js`
- **Node Packages:** `discord.js dotenv`
- **Node version:** 20 or newer

In the Apollo **File Manager**, create `.env` with `DISCORD_TOKEN` and `CLIENT_ID`. Leave `ENABLE_TRACKING_INTENTS=false` unless you have enabled the privileged intents in the Discord Developer Portal. Start the server from **Console**. A healthy startup prints `Ready as ...` and `Registered commands for server ...`.

The repository includes a GitHub Actions validation workflow at `.github/workflows/validate.yml`; every push and pull request runs `npm ci` and the JavaScript check. Apollo’s documented Git integration pulls the repository through its Startup Git settings and requires a reinstall/pull from the panel. For true push-to-deploy, configure an Apollo-compatible SFTP/API deployment secret and restart hook; do not commit `.env` or bot credentials.

## Usage

Run `/setup-verification` in your server to select the Verified role (and optional log channel), then run `/customize-verification` to customize its title, description, color, button text, emoji, and footer. Finally, use `/verification-panel` to post it.

Giveaways are managed with:

- `/giveaway-start` — prize, duration, winners, optional channel, title, description, and color.
- `/giveaway-edit` — edits an active giveaway with the same prize, duration, winners, channel, styling, keys, reward file/text, and winner-role fields.
- `/giveaway-end` — ends a giveaway early using its message ID.
- `/giveaway-reroll` — selects different winners from remaining entrants.
- `/giveaway-start` — optionally accepts `keys` (one key per line) or a `key-file` `.txt`/`.csv` upload directly in the command.

Reward delivery setup: run `/giveaway-start` and fill in the optional `keys` or `key-file` fields. You can also add `reward-file` to send any uploaded file type, choose its outgoing extension with `reward-file-type` (for example `lua`, `txt`, `json`, or `zip`), use `reward-text` to create a text/code file, or select `winner-role` to automatically assign a role. When the giveaway ends, each winner is sent a private embed DM with the key and/or file. The giveaway channel receives a `Reward delivery completed` embed showing delivery counts and role assignments; keys are never posted publicly. Winners who have DMs disabled are marked as undeliverable for staff follow-up.

These commands, along with verification setup, require **Manage Server**. Use `/help` for an in-Discord command guide.

## Tickets and Rivals Clan signup

1. Create a category for private tickets and a staff role that should see them.
2. Give the bot **Manage Channels**, **View Channels**, **Send Messages**, and **Embed Links** permissions.
3. Run `/setup-tickets` and choose that category and staff role.
4. Use `/customize-tickets`, then `/ticket-panel`, to publish Support, Report, and Other ticket buttons.
5. Use `/customize-rivals-signup`, then `/rivals-signup-panel`, to publish a Rivals Clan application panel. Applicants complete an in-Discord form and the bot creates a private ticket containing their answers.

Ticket owners or server managers can use the Close Ticket button or `/ticket-close`. Closing keeps the channel for staff records and stops the member from sending new messages.

Every ticket also includes a staff control panel. Staff can whitelist the ticket owner with a required reason, generate 1–50 whitelist keys with a required reason, rename the ticket, or close it. Generated keys are shown only to the staff member who requested them and are stored in the whitelist database.

## Whitelist setup

1. Create a normal Discord role for approved members and move the bot role above it.
2. Run `/setup-whitelist role:<role>`.
3. Optionally customize the embed with `/customize-whitelist`, then publish it with `/whitelist-panel`.
4. Generate private keys with `/whitelist-key-generate amount:<number>`. Keys are shown only to the administrator who generated them.
5. Members click the panel button and enter a key in the private modal. Each key works once and grants the configured role.
6. Staff can use `/whitelist-add user:<member>` or `/whitelist-remove user:<member>` for direct role management.

## Join, leave, and invite tracking

1. Enable **Server Members Intent** and **Guild Invites Intent** for the bot in the Discord Developer Portal.
2. Give the bot permission to **Manage Server** (needed to read invites) and permission to send embeds in the tracking channel.
3. Set `ENABLE_TRACKING_INTENTS=true` in `.env` and restart the bot.
4. Run `/setup-tracking channel:<channel>`.
5. Optionally run `/customize-tracking` with join/leave titles and descriptions. You can use `{user}`, `{member}`, `{invite}`, and `{count}` placeholders.

The bot posts an embed when members join or leave. For joins, it compares invite uses to attribute the invite when Discord makes that information available.

## Embed builder

- `/message-builder` builds and sends a plain message with an optional embed containing title, description, destination channel, color, footer, author, timestamp, image/GIF, and an additional file.
- `/message-edit` uses the same fields to edit an existing bot-authored message by message ID.
- Use `theme:default` for the built-in theme, or save your own with `/embed-theme-save name:<name> color:<hex>`. List them with `/embed-theme-list`.
- Uploaded files are attached to the sent message; uploaded images and GIFs are also displayed inside the embed.

## Moderation commands

The bot registers 25+ permission-gated moderation commands, including `/addrole`, `/removerole`, `/kick`, `/ban`, `/softban`, `/unban`, `/timeout`, `/untimeout`, `/mute`, `/unmute`, `/warn`, `/warnings`, `/warning-book`, `/remove-warning`, `/clear-warnings`, `/clear`, `/purge`, `/lock`, `/unlock`, `/hide`, `/unhide`, `/slowmode`, `/setnick`, `/resetnick`, `/deafen`, `/undeafen`, `/move`, `/roleinfo`, `/userinfo`, `/serverinfo`, `/announce`, and `/say`. Commands check Discord permissions and role hierarchy before acting. Each new warning receives a unique ID; use `/remove-warning` to remove only that warning.

Moderation command definitions and handlers are organized in [`src/commands/moderation.js`](C:/Users/ethan/Documents/ChatGPT/lol/src/commands/moderation.js); the main file handles startup, shared storage, and routing.

The remaining feature command groups are indexed in [`src/commands/groups.js`](C:/Users/ethan/Documents/ChatGPT/lol/src/commands/groups.js), which drives the organized `/help` command for verification, giveaways, tickets, Rivals, whitelist, tracking, and messaging.

Members click **Verify** and receive the configured role. Repeated clicks are harmless. Errors are shown only to the member who clicked.

## Important limitation

This is button-based acknowledgement, not CAPTCHA or identity verification. It is useful for accepting rules and unlocking channels, but it will not stop sophisticated automated accounts by itself.

Keep the bot token private. If it is ever exposed, reset it immediately in the Developer Portal.
