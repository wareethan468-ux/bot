import 'dotenv/config';
import {
  moderationCommands as organizedModerationCommands,
  moderationCommandNames as organizedModerationCommandNames,
  handleModerationCommand as handleOrganizedModerationCommand,
} from './commands/moderation.js';
import { commandGroups } from './commands/groups.js';

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = { token: process.env.DISCORD_TOKEN.trim(), clientId: process.env.CLIENT_ID.trim() };
const VERIFY_BUTTON_ID = 'verification:grant-role:v1';
const GIVEAWAY_BUTTON_PREFIX = 'giveaway:enter:';
const GIVEAWAY_END_BUTTON_PREFIX = 'giveaway:end:';
const GIVEAWAY_REFRESH_BUTTON_PREFIX = 'giveaway:refresh:';
const GIVEAWAY_PARTICIPANTS_PREFIX = 'giveaway:participants:';
const POLL_VOTE_PREFIX = 'poll:vote:';
const GLOBAL_BOT_BLACKLIST = new Set(['1324049089314426924', '1521163559780876309']);
const BOT_OWNER_IDS = new Set(['1504236410440253600', '1244476245249626133']);
const OWNER_ONLY_SERVER_IDS = new Set(['1538272402037809303']);
const REQUEST_APPROVE_PREFIX = 'access:approve:';
const REQUEST_DENY_PREFIX = 'access:deny:';
const LIBRARY_PAGE_PREFIX = 'library:page:';
const LIBRARY_PANEL_PREFIX = 'library:panel:';
const LIBRARY_STAFF_PREFIX = 'library:staff:';
const TICKET_BUTTON_PREFIX = 'ticket:create:';
const RIVALS_SIGNUP_BUTTON_ID = 'ticket:rivals-signup';
const TICKET_CLOSE_BUTTON_ID = 'ticket:close';
const TICKET_CLAIM_BUTTON_ID = 'ticket:claim';
const TICKET_TRYOUT_ACCEPT_BUTTON_ID = 'ticket:tryout-accept';
const TICKET_TRYOUT_DENY_BUTTON_ID = 'ticket:tryout-deny';
const TICKET_WHITELIST_BUTTON_ID = 'ticket:control-whitelist';
const TICKET_GENERATE_KEYS_BUTTON_ID = 'ticket:control-generate-keys';
const TICKET_RENAME_BUTTON_ID = 'ticket:control-rename';
const TICKET_WHITELIST_MODAL_ID = 'ticket:control-whitelist-modal';
const TICKET_GENERATE_KEYS_MODAL_ID = 'ticket:control-generate-keys-modal';
const TICKET_RENAME_MODAL_ID = 'ticket:control-rename-modal';
const RIVALS_SIGNUP_MODAL_ID = 'ticket:rivals-modal';
const CU_TRYOUT_TICKET_TYPE = 'CU Tryout Application';
const GAMBLING_STAFF_ROLE_ID = '1538297693217099828';
const DUEL_MODAL_ID = 'economy:duel-modal';
const DUEL_ACCEPT_PREFIX = 'economy:duel-accept:';
const DUEL_DECLINE_PREFIX = 'economy:duel-decline:';
const WHITELIST_BUTTON_ID = 'whitelist:redeem';
const WHITELIST_MODAL_ID = 'whitelist:key-modal';
const inviteCache = new Map();
const dataFile = join(process.cwd(), 'data', 'guild-config.json');
const timers = new Map();
const pendingDuels = new Map();
let guildConfigurations = {};
let messageSaveTimer = null;

const textChannelOption = (option) => option.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
const legacyModerationCommands = [
  new SlashCommandBuilder().setName('addrole').setDescription('Add a role to a member.').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('removerole').setDescription('Remove a role from a member.').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member.').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('delete-days').setDescription('Delete message history, 0-7 days').setMinValue(0).setMaxValue(7)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('softban').setDescription('Ban then unban a member.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addStringOption((o) => o.setName('user-id').setDescription('User ID').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('untimeout').setDescription('Remove a member timeout.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('mute').setDescription('Mute a member using a timeout.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('unmute').setDescription('Unmute a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('warnings').setDescription('View a member warning history.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('warning-book').setDescription('Open the full warning book for a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('remove-warning').setDescription('Remove one warning by its warning ID.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('warning-id').setDescription('Warning ID from /warnings').setRequired(true).setMaxLength(20)),
  new SlashCommandBuilder().setName('clear-warnings').setDescription('Clear a member warning history.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Delete recent messages.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption((o) => o.setName('amount').setDescription('1-100 messages').setRequired(true).setMinValue(1).setMaxValue(100)).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('purge').setDescription('Delete recent messages.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption((o) => o.setName('amount').setDescription('1-100 messages').setRequired(true).setMinValue(1).setMaxValue(100)).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('lock').setDescription('Lock a channel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addIntegerOption((o) => o.setName('seconds').setDescription('0-21600 seconds').setRequired(true).setMinValue(0).setMaxValue(21600)).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('setnick').setDescription('Set a member nickname.').setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('nickname').setDescription('New nickname').setRequired(true).setMaxLength(32)),
  new SlashCommandBuilder().setName('resetnick').setDescription('Reset a member nickname.').setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('deafen').setDescription('Deafen a voice member.').setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers).addUserOption((o) => o.setName('user').setDescription('Voice member').setRequired(true)),
  new SlashCommandBuilder().setName('undeafen').setDescription('Undeafen a voice member.').setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers).addUserOption((o) => o.setName('user').setDescription('Voice member').setRequired(true)),
  new SlashCommandBuilder().setName('move').setDescription('Move a member to a voice channel.').setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers).addUserOption((o) => o.setName('user').setDescription('Voice member').setRequired(true)).addChannelOption((o) => o.setName('channel').setDescription('Voice channel').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true)),
  new SlashCommandBuilder().setName('roleinfo').setDescription('Show role information.').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
  new SlashCommandBuilder().setName('userinfo').setDescription('Show member information.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show server information.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('announce').setDescription('Send a mod announcement embed.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addStringOption((o) => o.setName('title').setDescription('Title').setRequired(true).setMaxLength(256)).addStringOption((o) => o.setName('message').setDescription('Announcement').setRequired(true).setMaxLength(4000)).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('say').setDescription('Send a plain staff message.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addStringOption((o) => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(2000)).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('hide').setDescription('Hide a channel from everyone.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
  new SlashCommandBuilder().setName('unhide').setDescription('Show a channel to everyone.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Target channel'))),
];
const legacyModerationCommandNames = new Set(legacyModerationCommands.map((command) => command.name));
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show the bot commands.').addStringOption((o) => o.setName('category').setDescription('Focus the help embed').addChoices({ name: 'All', value: 'all' }, { name: 'Giveaways', value: 'giveaways' }, { name: 'Tickets', value: 'tickets' }, { name: 'Economy', value: 'economy' }, { name: 'Moderation', value: 'moderation' }, { name: 'Library', value: 'library' })),
  new SlashCommandBuilder().setName('server-copy').setDescription('Administrator: create a reusable server template code.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('server-paste').setDescription('Administrator: recreate a copied server template here.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('code').setDescription('Template code from /server-copy').setRequired(true).setMaxLength(30)),
  new SlashCommandBuilder().setName('server-config-copy').setDescription('Administrator: copy ticket and bot configuration into a template code.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('server-config-paste').setDescription('Administrator: paste ticket and bot configuration from a template code.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('code').setDescription('Template code').setRequired(true).setMaxLength(30)),
  new SlashCommandBuilder().setName('balance').setDescription('Check your CU coin balance.').addUserOption((o) => o.setName('user').setDescription('Optional member to check')),
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily CU coins.'),
  new SlashCommandBuilder().setName('coinflip').setDescription('Bet coins on heads or tails.').addIntegerOption((o) => o.setName('amount').setDescription('Coins to bet').setRequired(true).setMinValue(1).setMaxValue(1000000)).addStringOption((o) => o.setName('side').setDescription('Your pick').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),
  new SlashCommandBuilder().setName('slots').setDescription('Spin the CU slot machine.').addIntegerOption((o) => o.setName('amount').setDescription('Coins to bet').setRequired(true).setMinValue(1).setMaxValue(1000000)),
  new SlashCommandBuilder().setName('dice').setDescription('Guess a dice roll for a big payout.').addIntegerOption((o) => o.setName('amount').setDescription('Coins to bet').setRequired(true).setMinValue(1).setMaxValue(1000000)).addIntegerOption((o) => o.setName('guess').setDescription('Pick 1-6').setRequired(true).setMinValue(1).setMaxValue(6)),
  new SlashCommandBuilder().setName('roulette').setDescription('Pick a roulette number from 0 to 36.').addIntegerOption((o) => o.setName('amount').setDescription('Coins to bet').setRequired(true).setMinValue(1).setMaxValue(1000000)).addIntegerOption((o) => o.setName('number').setDescription('Pick 0-36').setRequired(true).setMinValue(0).setMaxValue(36)),
  new SlashCommandBuilder().setName('coin-leaderboard').setDescription('Show the richest CU members.'),
  new SlashCommandBuilder().setName('duel').setDescription('Challenge members to a CU duel.').addUserOption((o) => o.setName('opponent').setDescription('First opponent').setRequired(true)).addStringOption((o) => o.setName('mode').setDescription('Duel format').setRequired(true).addChoices({ name: '1v1', value: '1v1' }, { name: '2v1', value: '2v1' }, { name: '2v2', value: '2v2' })).addUserOption((o) => o.setName('opponent2').setDescription('Second opponent for 2v1/2v2')).addUserOption((o) => o.setName('opponent3').setDescription('Third opponent for 2v2')).addBooleanOption((o) => o.setName('your-server').setDescription('Ask for your server link before sending the challenge')),
  new SlashCommandBuilder().setName('duel-leaderboard').setDescription('Show advanced CU duel statistics.'),
  new SlashCommandBuilder().setName('duel-result').setDescription('Record a completed duel result.').addUserOption((o) => o.setName('winner').setDescription('Winner').setRequired(true)).addUserOption((o) => o.setName('loser').setDescription('Loser').setRequired(true)),
  new SlashCommandBuilder().setName('economy-config').setDescription('Customize the CU economy.').addStringOption((o) => o.setName('currency').setDescription('Currency name, such as CU Coins').setMaxLength(30)).addStringOption((o) => o.setName('emoji').setDescription('Currency emoji').setMaxLength(8)).addIntegerOption((o) => o.setName('daily-amount').setDescription('Daily reward').setMinValue(0).setMaxValue(1000000)).addIntegerOption((o) => o.setName('starting-balance').setDescription('Balance for new members').setMinValue(0).setMaxValue(1000000)).addIntegerOption((o) => o.setName('max-bet').setDescription('Maximum wager').setMinValue(1).setMaxValue(1000000000)).addStringOption((o) => o.setName('color').setDescription('Embed color hex').setMaxLength(7)),
  new SlashCommandBuilder().setName('economy-reset').setDescription('Reset one member or everyone’s CU balance.').addUserOption((o) => o.setName('user').setDescription('Member to reset (leave blank for everyone)')),
  new SlashCommandBuilder().setName('economy-add').setDescription('Add CU coins to a member.').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('amount').setDescription('Coins to add').setRequired(true).setMinValue(1).setMaxValue(1000000000)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(200)),
  new SlashCommandBuilder().setName('economy-remove').setDescription('Remove CU coins from a member.').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('amount').setDescription('Coins to remove').setRequired(true).setMinValue(1).setMaxValue(1000000000)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(200)),
  new SlashCommandBuilder()
    .setName('setup-verification')
    .setDescription('Choose the role granted after verification.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) => option.setName('role').setDescription('Role granted after verification').setRequired(true))
    .addChannelOption((option) => textChannelOption(option.setName('log-channel').setDescription('Optional verification log channel'))),
  new SlashCommandBuilder()
    .setName('customize-verification')
    .setDescription('Customize the verification panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('title').setDescription('Embed title').setMaxLength(100))
    .addStringOption((option) => option.setName('description').setDescription('Embed description').setMaxLength(1000))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #57F287').setMaxLength(7))
    .addStringOption((option) => option.setName('button-label').setDescription('Button text').setMaxLength(80))
    .addStringOption((option) => option.setName('button-emoji').setDescription('Unicode button emoji, for example ✅').setMaxLength(32))
    .addStringOption((option) => option.setName('footer').setDescription('Embed footer').setMaxLength(200)),
  new SlashCommandBuilder()
    .setName('verification-panel')
    .setDescription('Post the customized verification panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Panel channel (defaults to this channel'))),
  new SlashCommandBuilder()
    .setName('giveaway-start')
    .setDescription('Start a button-entry giveaway.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('prize').setDescription('What members can win').setRequired(true).setMaxLength(200))
    .addStringOption((option) => option.setName('duration').setDescription('Examples: 10m, 2h, 3d').setRequired(true).setMaxLength(10))
    .addIntegerOption((option) => option.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(20))
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Giveaway channel (defaults to this channel')))
    .addStringOption((option) => option.setName('description').setDescription('Extra giveaway details').setMaxLength(1000))
    .addStringOption((option) => option.setName('title').setDescription('Custom giveaway title').setMaxLength(100))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #FEE75C').setMaxLength(7))
    .addStringOption((option) => option.setName('keys').setDescription('Optional: one reward key per line').setMaxLength(4000))
    .addAttachmentOption((option) => option.setName('key-file').setDescription('Optional file with one reward key per line'))
    .addAttachmentOption((option) => option.setName('reward-file').setDescription('Optional file sent to each winner'))
    .addStringOption((option) => option.setName('reward-file-type').setDescription('Extension for the reward file, such as lua, txt, json, or zip').setMaxLength(10))
    .addStringOption((option) => option.setName('reward-text').setDescription('Optional text turned into a reward file').setMaxLength(4000))
    .addRoleOption((option) => option.setName('winner-role').setDescription('Optional role automatically given to winners'))
    .addIntegerOption((option) => option.setName('min-account-age').setDescription('Minimum Discord account age in days').setMinValue(0))
    .addIntegerOption((option) => option.setName('min-messages').setDescription('Minimum messages sent in this server').setMinValue(0))
    .addIntegerOption((option) => option.setName('min-server-days').setDescription('Minimum days the member must be in this server').setMinValue(0))
    .addBooleanOption((option) => option.setName('require-avatar').setDescription('Require a custom Discord avatar'))
    .addBooleanOption((option) => option.setName('require-nickname').setDescription('Require a server nickname'))
    .addRoleOption((option) => option.setName('required-role').setDescription('Role required to enter'))
    .addRoleOption((option) => option.setName('blacklist-role').setDescription('Role blocked from entering')),
  new SlashCommandBuilder()
    .setName('giveaway-end')
    .setDescription('End an active giveaway immediately.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('message-id').setDescription('Giveaway message ID').setRequired(true).setMaxLength(25)),
  new SlashCommandBuilder()
    .setName('giveaway-reroll')
    .setDescription('Pick new winners for a finished giveaway.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('message-id').setDescription('Giveaway message ID').setRequired(true).setMaxLength(25)),
  new SlashCommandBuilder()
    .setName('giveaway-edit')
    .setDescription('Edit an active giveaway using the same giveaway fields.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) => option.setName('message-id').setDescription('Giveaway message ID').setRequired(true).setMaxLength(25))
    .addStringOption((option) => option.setName('prize').setDescription('Updated prize').setMaxLength(200))
    .addStringOption((option) => option.setName('duration').setDescription('Reset duration: 10m, 2h, 3d').setMaxLength(10))
    .addIntegerOption((option) => option.setName('winners').setDescription('Updated number of winners').setMinValue(1).setMaxValue(20))
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Move giveaway to another channel')))
    .addStringOption((option) => option.setName('description').setDescription('Updated details').setMaxLength(1000))
    .addStringOption((option) => option.setName('title').setDescription('Updated title').setMaxLength(100))
    .addStringOption((option) => option.setName('color').setDescription('Updated hex color').setMaxLength(7))
    .addStringOption((option) => option.setName('keys').setDescription('Additional reward keys, one per line').setMaxLength(4000))
    .addAttachmentOption((option) => option.setName('key-file').setDescription('Additional key file'))
    .addAttachmentOption((option) => option.setName('reward-file').setDescription('Updated reward file'))
    .addStringOption((option) => option.setName('reward-file-type').setDescription('Reward extension, such as lua or txt').setMaxLength(10))
    .addStringOption((option) => option.setName('reward-text').setDescription('Updated text reward file').setMaxLength(4000))
    .addRoleOption((option) => option.setName('winner-role').setDescription('Updated winner role'))
    .addIntegerOption((option) => option.setName('min-account-age').setDescription('Minimum account age in days').setMinValue(0))
    .addIntegerOption((option) => option.setName('min-messages').setDescription('Minimum messages sent in this server').setMinValue(0))
    .addIntegerOption((option) => option.setName('min-server-days').setDescription('Minimum days the member must be in this server').setMinValue(0))
    .addBooleanOption((option) => option.setName('require-avatar').setDescription('Require a custom Discord avatar'))
    .addBooleanOption((option) => option.setName('require-nickname').setDescription('Require a server nickname'))
    .addRoleOption((option) => option.setName('required-role').setDescription('Role required to enter'))
    .addRoleOption((option) => option.setName('blacklist-role').setDescription('Role blocked from entering')),
  new SlashCommandBuilder().setName('giveaway-entry-add').setDescription('Administrator: add a user to a giveaway.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('message-id').setDescription('Giveaway message ID').setRequired(true)).addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('giveaway-entry-remove').setDescription('Administrator: remove a user from a giveaway.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('message-id').setDescription('Giveaway message ID').setRequired(true)).addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('giveaway-blacklist').setDescription('Administrator: blacklist or unblacklist a giveaway user.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('message-id').setDescription('Giveaway message ID').setRequired(true)).addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)).addStringOption((o) => o.setName('action').setDescription('Blacklist action').setRequired(true).addChoices({ name: 'Blacklist', value: 'add' }, { name: 'Remove blacklist', value: 'remove' })),
  new SlashCommandBuilder().setName('poll-start').setDescription('Create a button poll with live results.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption((o) => o.setName('question').setDescription('Poll question').setRequired(true).setMaxLength(300)).addStringOption((o) => o.setName('options').setDescription('Comma-separated options (2-5)').setRequired(true).setMaxLength(500)).addStringOption((o) => o.setName('duration').setDescription('Examples: 10m, 2h, 3d').setRequired(true)).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Poll channel'))).addStringOption((o) => o.setName('title').setDescription('Poll title').setMaxLength(100)).addStringOption((o) => o.setName('color').setDescription('Embed hex color').setMaxLength(7)),
  new SlashCommandBuilder().setName('poll-edit').setDescription('Edit an active poll.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption((o) => o.setName('message-id').setDescription('Poll message ID').setRequired(true)).addStringOption((o) => o.setName('question').setDescription('Updated question').setMaxLength(300)).addStringOption((o) => o.setName('options').setDescription('Updated comma-separated options (2-5)').setMaxLength(500)).addStringOption((o) => o.setName('duration').setDescription('Reset duration: 10m, 2h, 3d')).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Move poll channel'))).addStringOption((o) => o.setName('title').setDescription('Updated title').setMaxLength(100)).addStringOption((o) => o.setName('color').setDescription('Updated hex color').setMaxLength(7)),
  new SlashCommandBuilder().setName('poll-end').setDescription('End a poll immediately.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('message-id').setDescription('Poll message ID').setRequired(true)),
  new SlashCommandBuilder().setName('poll-voters').setDescription('Administrator: list voters for a poll option.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('message-id').setDescription('Poll message ID').setRequired(true)).addIntegerOption((o) => o.setName('option').setDescription('Option number').setRequired(true).setMinValue(1).setMaxValue(5)),
  new SlashCommandBuilder().setName('poll-vote-remove').setDescription('Administrator: remove a user vote.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('message-id').setDescription('Poll message ID').setRequired(true)).addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('user-blacklist-add').setDescription('Administrator: blacklist a user ID in this server.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('user-id').setDescription('Discord user ID').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(300)),
  new SlashCommandBuilder().setName('user-blacklist-remove').setDescription('Administrator: remove a user ID from the blacklist.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption((o) => o.setName('user-id').setDescription('Discord user ID').setRequired(true)),
  new SlashCommandBuilder().setName('user-blacklist-list').setDescription('Administrator: list blacklisted user IDs.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Configure private ticket creation for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => option.setName('category').setDescription('Category for newly created tickets').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addRoleOption((option) => option.setName('staff-role').setDescription('Role that can view and reply to tickets').setRequired(true))
    .addRoleOption((option) => option.setName('tryout-role').setDescription('Role given automatically when a CU tryout is accepted'))
    .addChannelOption((option) => textChannelOption(option.setName('log-channel').setDescription('Optional ticket log channel')))
    .addChannelOption((option) => textChannelOption(option.setName('notification-channel').setDescription('Channel for claims, tryout decisions, and closed-ticket notices'))),
  new SlashCommandBuilder()
    .setName('customize-tickets')
    .setDescription('Customize the general ticket panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('title').setDescription('Panel title').setMaxLength(100))
    .addStringOption((option) => option.setName('description').setDescription('Panel description').setMaxLength(1000))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #5865F2').setMaxLength(7))
    .addStringOption((option) => option.setName('footer').setDescription('Panel footer').setMaxLength(200))
    .addStringOption((option) => option.setName('support-label').setDescription('Support button label').setMaxLength(80))
    .addStringOption((option) => option.setName('report-label').setDescription('Report button label').setMaxLength(80))
    .addStringOption((option) => option.setName('other-label').setDescription('Other button label').setMaxLength(80)),
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Post the customizable general ticket panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Panel channel (defaults to this channel)'))),
  new SlashCommandBuilder()
    .setName('customize-rivals-signup')
    .setDescription('Customize the CU tryout signup panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('title').setDescription('Panel title').setMaxLength(100))
    .addStringOption((option) => option.setName('description').setDescription('Panel description').setMaxLength(1000))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #ED4245').setMaxLength(7))
    .addStringOption((option) => option.setName('footer').setDescription('Panel footer').setMaxLength(200))
    .addStringOption((option) => option.setName('button-label').setDescription('Signup button label').setMaxLength(80)),
  new SlashCommandBuilder()
    .setName('rivals-signup-panel')
    .setDescription('Post the CU tryout signup panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Panel channel (defaults to this channel)'))),
  new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close the current ticket channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('setup-whitelist')
    .setDescription('Choose the role granted by whitelist keys.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) => option.setName('role').setDescription('Role granted after redeeming a key').setRequired(true)),
  new SlashCommandBuilder()
    .setName('customize-whitelist')
    .setDescription('Customize the whitelist redemption panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('title').setDescription('Panel title').setMaxLength(100))
    .addStringOption((option) => option.setName('description').setDescription('Panel description').setMaxLength(1000))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #00B0F4').setMaxLength(7))
    .addStringOption((option) => option.setName('button-label').setDescription('Button text').setMaxLength(80))
    .addStringOption((option) => option.setName('footer').setDescription('Panel footer').setMaxLength(200)),
  new SlashCommandBuilder()
    .setName('whitelist-panel')
    .setDescription('Post the whitelist key redemption panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Panel channel (defaults to this channel)'))),
  new SlashCommandBuilder()
    .setName('whitelist-key-generate')
    .setDescription('Generate one or more whitelist keys.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((option) => option.setName('amount').setDescription('Number of keys to generate').setRequired(true).setMinValue(1).setMaxValue(50)),
  new SlashCommandBuilder()
    .setName('whitelist-add')
    .setDescription('Directly give a user the whitelist role.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('User to whitelist').setRequired(true)),
  new SlashCommandBuilder()
    .setName('whitelist-remove')
    .setDescription('Remove the whitelist role from a user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('User to remove from the whitelist').setRequired(true)),
  new SlashCommandBuilder()
    .setName('setup-tracking')
    .setDescription('Choose where join and leave embeds are posted.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Join/leave log channel').setRequired(true))),
  new SlashCommandBuilder()
    .setName('customize-tracking')
    .setDescription('Customize join and leave tracking embeds.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('join-title').setDescription('Join embed title').setMaxLength(100))
    .addStringOption((option) => option.setName('join-description').setDescription('Join embed description').setMaxLength(1000))
    .addStringOption((option) => option.setName('leave-title').setDescription('Leave embed title').setMaxLength(100))
    .addStringOption((option) => option.setName('leave-description').setDescription('Leave embed description').setMaxLength(1000))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #5865F2').setMaxLength(7)),
  new SlashCommandBuilder()
    .setName('embed-theme-save')
    .setDescription('Save a reusable custom embed theme.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('name').setDescription('Theme name').setRequired(true).setMaxLength(30))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #5865F2').setRequired(true).setMaxLength(7))
    .addStringOption((option) => option.setName('footer').setDescription('Default footer').setMaxLength(200))
    .addStringOption((option) => option.setName('author').setDescription('Default author name').setMaxLength(100)),
  new SlashCommandBuilder()
    .setName('embed-theme-list')
    .setDescription('List saved custom embed themes.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('message-builder')
    .setDescription('Build and send a message with an optional embed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('content').setDescription('Optional plain message content').setMaxLength(2000))
    .addStringOption((option) => option.setName('title').setDescription('Optional embed title').setMaxLength(256))
    .addStringOption((option) => option.setName('description').setDescription('Optional embed description').setMaxLength(4096))
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Destination channel (defaults to this channel)')))
    .addStringOption((option) => option.setName('theme').setDescription('Use default or a saved custom theme').setMaxLength(30))
    .addStringOption((option) => option.setName('color').setDescription('Override theme color with hex').setMaxLength(7))
    .addStringOption((option) => option.setName('footer').setDescription('Override footer').setMaxLength(200))
    .addStringOption((option) => option.setName('author').setDescription('Override author').setMaxLength(100))
    .addBooleanOption((option) => option.setName('timestamp').setDescription('Show the current timestamp'))
    .addAttachmentOption((option) => option.setName('image').setDescription('Image/GIF attached to the embed'))
    .addAttachmentOption((option) => option.setName('file').setDescription('Any additional file to send with the embed')),
  new SlashCommandBuilder()
    .setName('message-edit')
    .setDescription('Edit a bot message using the message builder fields.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('message-id').setDescription('Message ID to edit').setRequired(true).setMaxLength(25))
    .addStringOption((option) => option.setName('content').setDescription('Optional plain message content').setMaxLength(2000))
    .addStringOption((option) => option.setName('title').setDescription('Optional embed title').setMaxLength(256))
    .addStringOption((option) => option.setName('description').setDescription('Optional embed description').setMaxLength(4096))
    .addChannelOption((option) => textChannelOption(option.setName('channel').setDescription('Message channel (defaults to this channel)')))
    .addStringOption((option) => option.setName('theme').setDescription('Use default or a saved custom theme').setMaxLength(30))
    .addStringOption((option) => option.setName('color').setDescription('Override theme color with hex').setMaxLength(7))
    .addStringOption((option) => option.setName('footer').setDescription('Override footer').setMaxLength(200))
    .addStringOption((option) => option.setName('author').setDescription('Override author').setMaxLength(100))
    .addBooleanOption((option) => option.setName('timestamp').setDescription('Show the current timestamp'))
    .addAttachmentOption((option) => option.setName('image').setDescription('Image/GIF attached to the embed'))
    .addAttachmentOption((option) => option.setName('file').setDescription('Any additional file to send with the embed')),
  new SlashCommandBuilder()
    .setName('channel-access')
    .setDescription('Allow or remove a role from a channel or category.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) => option.setName('channel').setDescription('Channel or category').addChannelTypes(ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role to manage').setRequired(true))
    .addStringOption((option) => option.setName('action').setDescription('Access action').setRequired(true).addChoices({ name: 'Allow role', value: 'allow' }, { name: 'Remove role', value: 'remove' })),
  new SlashCommandBuilder()
    .setName('channel-access-list')
    .setDescription('List role access overwrites for a channel or category.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) => option.setName('channel').setDescription('Channel or category').addChannelTypes(ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true)),
  new SlashCommandBuilder().setName('maintenance-lock').setDescription('Administrator: lock a category to one maintenance role.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption((o) => o.setName('category').setDescription('Category to lock').addChannelTypes(ChannelType.GuildCategory).setRequired(true)).addRoleOption((o) => o.setName('role').setDescription('Only this role can see the category').setRequired(true)),
  new SlashCommandBuilder().setName('maintenance-unlock').setDescription('Administrator: remove maintenance visibility restrictions.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption((o) => o.setName('category').setDescription('Category to unlock').addChannelTypes(ChannelType.GuildCategory).setRequired(true)),
  new SlashCommandBuilder().setName('request').setDescription('Request bot/user/server approval from the bot owners.').addStringOption((o) => o.setName('type').setDescription('Approval type').setRequired(true).addChoices({ name: 'Server', value: 'server' }, { name: 'User', value: 'user' })).addStringOption((o) => o.setName('target-id').setDescription('Server ID or user ID').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Why approval is needed').setMaxLength(500)),
  new SlashCommandBuilder().setName('global-blacklist').setDescription('Owner only: manage global bot blacklists.').addStringOption((o) => o.setName('type').setDescription('Blacklist type').setRequired(true).addChoices({ name: 'User', value: 'user' }, { name: 'Server', value: 'server' })).addStringOption((o) => o.setName('target-id').setDescription('User ID or server ID').setRequired(true)).addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })),
  new SlashCommandBuilder().setName('global-whitelist').setDescription('Owner only: manage global approved users or servers.').addStringOption((o) => o.setName('type').setDescription('Whitelist type').setRequired(true).addChoices({ name: 'User', value: 'user' }, { name: 'Server', value: 'server' })).addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }, { name: 'List', value: 'list' })).addStringOption((o) => o.setName('target-id').setDescription('User ID or server ID')),
  new SlashCommandBuilder().setName('command-search').setDescription('Owner only: search registered bot commands.').addStringOption((o) => o.setName('query').setDescription('Search text').setRequired(true).setMaxLength(50)).addStringOption((o) => o.setName('category').setDescription('Optional command category').addChoices({ name: 'Giveaways', value: 'giveaways' }, { name: 'Tickets', value: 'tickets' }, { name: 'Economy', value: 'economy' }, { name: 'Moderation', value: 'moderation' }, { name: 'Library', value: 'library' })),
  new SlashCommandBuilder().setName('reaction-reward').setDescription('Create a reaction reward on a message.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Message channel').setRequired(true))).addStringOption((o) => o.setName('message-id').setDescription('Message ID').setRequired(true)).addStringOption((o) => o.setName('emoji').setDescription('Emoji to react with, such as 🎁').setRequired(true).setMaxLength(100)).addStringOption((o) => o.setName('reward-text').setDescription('Text sent by DM').setMaxLength(4000)).addAttachmentOption((o) => o.setName('reward-file').setDescription('File sent by DM')).addStringOption((o) => o.setName('file-type').setDescription('File extension, such as lua or txt').setMaxLength(10)),
  new SlashCommandBuilder().setName('reaction-reward-remove').setDescription('Remove a reaction reward.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Message channel').setRequired(true))).addStringOption((o) => o.setName('message-id').setDescription('Message ID').setRequired(true)),
  new SlashCommandBuilder().setName('config-library-add').setDescription('Admin: add a configuration/library entry.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption((o) => o.setName('name').setDescription('Entry name').setRequired(true).setMaxLength(80)).addStringOption((o) => o.setName('description').setDescription('Entry description').setMaxLength(1000)).addStringOption((o) => o.setName('text').setDescription('Optional text (use files for large content)').setMaxLength(4000)).addAttachmentOption((o) => o.setName('file1').setDescription('First file')).addAttachmentOption((o) => o.setName('file2').setDescription('Second file')).addAttachmentOption((o) => o.setName('file3').setDescription('Third file')).addStringOption((o) => o.setName('file-type').setDescription('Extension for text, such as lua or txt').setMaxLength(10)).addStringOption((o) => o.setName('tier').setDescription('Free or buyer-only').addChoices({ name: 'Free', value: 'free' }, { name: 'Buyer', value: 'buyer' })).addIntegerOption((o) => o.setName('price').setDescription('CU coin price for buyer entries').setMinValue(0).setMaxValue(1000000000)),
  new SlashCommandBuilder().setName('library-panel').setDescription('Admin: post a Free or Buyer library panel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addChannelOption((o) => textChannelOption(o.setName('channel').setDescription('Panel channel').setRequired(true))).addStringOption((o) => o.setName('tier').setDescription('Panel type').setRequired(true).addChoices({ name: 'Free', value: 'free' }, { name: 'Buyer', value: 'buyer' })).addStringOption((o) => o.setName('title').setDescription('Panel title').setMaxLength(100)).addStringOption((o) => o.setName('description').setDescription('Panel description').setMaxLength(1000)).addStringOption((o) => o.setName('color').setDescription('Hex color').setMaxLength(7)),
  new SlashCommandBuilder().setName('config-library-remove').setDescription('Admin: remove a configuration/library entry.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption((o) => o.setName('name').setDescription('Entry name').setRequired(true).setMaxLength(80)),
  new SlashCommandBuilder().setName('config-library-settings').setDescription('Admin: customize the library embed.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addStringOption((o) => o.setName('title').setDescription('Embed title').setMaxLength(100)).addStringOption((o) => o.setName('description').setDescription('Embed description').setMaxLength(1000)).addStringOption((o) => o.setName('color').setDescription('Hex color').setMaxLength(7)).addStringOption((o) => o.setName('footer').setDescription('Embed footer').setMaxLength(200)),
  new SlashCommandBuilder().setName('library').setDescription('Browse the configuration library.').addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1)).addStringOption((o) => o.setName('get').setDescription('Entry name to DM').setMaxLength(80)),
  new SlashCommandBuilder().setName('config-library').setDescription('Browse or DM the configuration library.').addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1)).addStringOption((o) => o.setName('get').setDescription('Entry name to DM').setMaxLength(80)),
  ...organizedModerationCommands,
].map((command) => command.toJSON());

const trackingIntentsEnabled = process.env.ENABLE_TRACKING_INTENTS === 'true';
const clientIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions];
if (trackingIntentsEnabled) clientIntents.push(GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildInvites);
const client = new Client({ intents: clientIntents, partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User] });
const rest = new REST({ version: '10' }).setToken(app.token);

async function loadConfigurations() {
  try {
    guildConfigurations = JSON.parse(await readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    guildConfigurations = {};
  }
}

async function saveConfigurations() {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(guildConfigurations, null, 2)}\n`, 'utf8');
}

function configuration(guildId) {
  return guildConfigurations[guildId] || null;
}

function ensureConfiguration(guildId) {
  guildConfigurations[guildId] ||= {};
  guildConfigurations[guildId].giveaways ||= [];
  guildConfigurations[guildId].polls ||= [];
  guildConfigurations[guildId].reactionRewards ||= [];
  guildConfigurations[guildId].library ||= { entries: [], panel: {} };
  guildConfigurations[guildId].library.entries ||= [];
  guildConfigurations[guildId].library.panel ||= {};
  guildConfigurations[guildId].userBlacklist ||= {};
  guildConfigurations[guildId].serverTemplates ||= {};
  guildConfigurations[guildId].economy ||= { balances: {}, daily: {}, currency: 'CU Coins', emoji: '🪙', dailyAmount: 500, startingBalance: 0, maxBet: 1000000, color: '#5865F2' };
  guildConfigurations[guildId].economy.balances ||= {};
  guildConfigurations[guildId].economy.daily ||= {};
  guildConfigurations[guildId].economy.duelStats ||= {};
  guildConfigurations[guildId].messageCounts ||= {};
  guildConfigurations[guildId].economy.currency ||= 'CU Coins';
  guildConfigurations[guildId].economy.emoji ||= '🪙';
  guildConfigurations[guildId].economy.dailyAmount ??= 500;
  guildConfigurations[guildId].economy.startingBalance ??= 0;
  guildConfigurations[guildId].economy.maxBet ??= 1000000;
  guildConfigurations[guildId].economy.color ||= '#5865F2';
  guildConfigurations[guildId].panel ||= {};
  guildConfigurations[guildId].tickets ||= { panel: {}, rivalsPanel: {}, open: {}, notificationChannelId: null, tryoutRoleId: null };
  guildConfigurations[guildId].tickets.panel ||= {};
  guildConfigurations[guildId].tickets.rivalsPanel ||= {};
  guildConfigurations[guildId].tickets.open ||= {};
  guildConfigurations[guildId].tickets.notificationChannelId ||= null;
  guildConfigurations[guildId].tickets.tryoutRoleId ||= null;
  guildConfigurations[guildId].whitelist ||= { keys: {}, panel: {} };
  guildConfigurations[guildId].whitelist.keys ||= {};
  guildConfigurations[guildId].whitelist.panel ||= {};
  guildConfigurations[guildId].tracking ||= { channelId: null, panel: {} };
  guildConfigurations[guildId].tracking.panel ||= {};
  guildConfigurations[guildId].themes ||= {};
  guildConfigurations[guildId].warnings ||= {};
  return guildConfigurations[guildId];
}

function parseColor(value, fallback) {
  if (!value) return fallback;
  if (!/^#?[0-9a-f]{6}$/i.test(value)) throw new Error('Color must be a 6-digit hex value, for example #57F287.');
  return Number.parseInt(value.replace('#', ''), 16);
}

function formatEndTime(endsAt) {
  return `<t:${Math.floor(endsAt / 1000)}:R> • <t:${Math.floor(endsAt / 1000)}:F>`;
}

function parseDuration(value) {
  const match = /^(\d+)\s*([mhdw])$/i.exec(value.trim());
  if (!match) throw new Error('Duration must look like 10m, 2h, 3d, or 1w.');
  const amount = Number(match[1]);
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  const duration = amount * multipliers[match[2].toLowerCase()];
  if (!Number.isSafeInteger(duration) || duration < 60_000 || duration > 2_419_200_000) {
    throw new Error('Giveaway duration must be between 1 minute and 28 days.');
  }
  return duration;
}

function rewardExtension(value) {
  const extension = (value || 'txt').trim().replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(extension)) throw new Error('Reward file type must be a simple extension such as lua, txt, json, or zip.');
  return extension;
}

function verificationPanel(panel = {}) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(panel.color, 0x57f287))
    .setTitle(panel.title || 'Server Verification')
    .setDescription(panel.description || 'Click the button below to verify and unlock the server.')
    .addFields({ name: 'What happens next?', value: 'You will immediately receive the verified member role.' })
    .setFooter({ text: panel.footer || 'One click is all it takes.' })
    .setTimestamp();
  const button = new ButtonBuilder().setCustomId(VERIFY_BUTTON_ID).setLabel(panel.buttonLabel || 'Verify').setStyle(ButtonStyle.Success);
  if (panel.buttonEmoji) button.setEmoji(panel.buttonEmoji);
  else button.setEmoji('✅');
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

function ticketPanel(panel = {}) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(panel.color, 0x5865f2))
    .setTitle(panel.title || 'Support Tickets')
    .setDescription(panel.description || 'Choose the option that best matches what you need. Our staff will respond in a private channel.')
    .addFields(
      { name: panel.supportLabel || 'Support', value: 'Questions, account help, or general assistance.', inline: true },
      { name: panel.reportLabel || 'Report', value: 'Report a player or an issue privately.', inline: true },
      { name: panel.otherLabel || 'Other', value: 'Anything else you need to discuss with staff.', inline: true },
    )
    .setFooter({ text: panel.footer || 'Please do not create duplicate tickets.' })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${TICKET_BUTTON_PREFIX}support`).setLabel(panel.supportLabel || 'Support').setEmoji('🎫').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${TICKET_BUTTON_PREFIX}report`).setLabel(panel.reportLabel || 'Report').setEmoji('🚨').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`${TICKET_BUTTON_PREFIX}other`).setLabel(panel.otherLabel || 'Other').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    )],
  };
}

function rivalsSignupPanel(panel = {}) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(panel.color, 0xed4245))
    .setTitle(panel.title || 'CU Tryout Signup')
    .setDescription(panel.description || 'Want to join CU? Press the button and complete the tryout application. Staff will review it in a private ticket.')
    .setFooter({ text: panel.footer || 'One application per player, please.' })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(RIVALS_SIGNUP_BUTTON_ID).setLabel(panel.buttonLabel || 'Apply to CU').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
    )],
  };
}

function whitelistPanel(panel = {}) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(panel.color, 0x00b0f4))
    .setTitle(panel.title || 'Whitelist Access')
    .setDescription(panel.description || 'Have a whitelist key? Press the button below and enter it privately to receive the whitelist role.')
    .setFooter({ text: panel.footer || 'Keys can only be redeemed once.' })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(WHITELIST_BUTTON_ID).setLabel(panel.buttonLabel || 'Redeem Whitelist Key').setEmoji('🔑').setStyle(ButtonStyle.Primary),
    )],
  };
}

function ticketWelcomeEmbed(ticket) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(ticket.type)
    .setDescription(`Welcome ${ticket.ownerMention}. Staff will be with you shortly. Please describe your request in as much detail as possible.`)
    .addFields({ name: 'Created by', value: ticket.ownerMention, inline: true }, { name: 'Status', value: 'Open', inline: true })
    .setFooter({ text: 'Use the button below to close this ticket when it is resolved.' })
    .setTimestamp();
}

function ticketCloseComponents(disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(TICKET_CLOSE_BUTTON_ID).setLabel(disabled ? 'Ticket closed' : 'Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  )];
}

function ticketControlPanel() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Staff Ticket Control Panel')
      .setDescription('Staff can manage this ticket with the controls below. Whitelist actions require a reason and are recorded.')
      .setFooter({ text: 'Only the configured staff role or server managers can use staff controls.' })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(TICKET_CLAIM_BUTTON_ID).setLabel('Claim Ticket').setEmoji('🙋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(TICKET_WHITELIST_BUTTON_ID).setLabel('Whitelist Owner').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(TICKET_GENERATE_KEYS_BUTTON_ID).setLabel('Generate Keys').setEmoji('🔑').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(TICKET_RENAME_BUTTON_ID).setLabel('Rename Ticket').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(TICKET_CLOSE_BUTTON_ID).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    )],
  };
}

function tryoutControlPanel() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('Tryout Staff Panel')
      .setDescription('Staff can claim this application and record the tryout decision here.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(TICKET_CLAIM_BUTTON_ID).setLabel('Claim Tryout').setEmoji('🙋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(TICKET_TRYOUT_ACCEPT_BUTTON_ID).setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(TICKET_TRYOUT_DENY_BUTTON_ID).setLabel('Deny').setEmoji('❌').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(TICKET_CLOSE_BUTTON_ID).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    )],
  };
}

function giveawayEmbed(giveaway, ended = false) {
  const requirements = [];
  if (giveaway.minAccountAgeDays) requirements.push(`Account age: **${giveaway.minAccountAgeDays}+ days**`);
  if (giveaway.minMessages) requirements.push(`Server messages: **${giveaway.minMessages}+**`);
  if (giveaway.minServerDays) requirements.push(`Server membership: **${giveaway.minServerDays}+ days**`);
  if (giveaway.requireAvatar) requirements.push('Custom avatar required');
  if (giveaway.requireNickname) requirements.push('Server nickname required');
  if (giveaway.requiredRoleId) requirements.push(`Required role: <@&${giveaway.requiredRoleId}>`);
  if (giveaway.blacklistRoleId) requirements.push(`Blocked role: <@&${giveaway.blacklistRoleId}>`);
  return new EmbedBuilder()
    .setColor(parseColor(giveaway.color, ended ? 0x747f8d : 0xfee75c))
    .setTitle(giveaway.title || (ended ? 'Giveaway Ended' : '🎉 Giveaway'))
    .setDescription(giveaway.description || `Enter below for a chance to win **${giveaway.prize}**!`)
    .addFields(
      { name: 'Prize', value: giveaway.prize, inline: true },
      { name: 'Winners', value: String(giveaway.winnerCount), inline: true },
      ...(giveaway.winnerRoleId ? [{ name: 'Winner role', value: `<@&${giveaway.winnerRoleId}>`, inline: true }] : []),
      { name: 'Participants', value: `**${giveaway.entries.length}**`, inline: true },
      ...(requirements.length ? [{ name: 'Entry requirements', value: requirements.join('\n') }] : []),
      { name: ended ? 'Ended' : 'Ends', value: ended ? 'This giveaway has ended.' : formatEndTime(giveaway.endsAt) },
    )
    .setFooter({ text: `${giveaway.entries.length} entr${giveaway.entries.length === 1 ? 'y' : 'ies'}` });
}

function giveawayComponents(giveaway, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${GIVEAWAY_BUTTON_PREFIX}${giveaway.messageId}`)
      .setLabel(disabled ? 'Giveaway ended' : 'Enter Giveaway')
      .setEmoji(disabled ? '🔒' : '🎉')
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${GIVEAWAY_END_BUTTON_PREFIX}${giveaway.messageId}`)
      .setLabel('End Giveaway')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${GIVEAWAY_REFRESH_BUTTON_PREFIX}${giveaway.messageId}`)
      .setLabel('Refresh Count')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${GIVEAWAY_PARTICIPANTS_PREFIX}${giveaway.messageId}`)
      .setLabel('View Participants')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  )];
}

function helpMessage(category = 'all') {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Bot Command Center')
      .setDescription(`Everything is grouped below. Showing: **${category}**. Setup commands are for staff; member-facing panels can then be posted wherever you need them.`)
      .addFields(
        { name: 'Quick start', value: '1. Configure a feature\n2. Customize it (optional)\n3. Post its panel\n4. Use `/help` any time', inline: false },
        { name: 'Verification', value: commandGroups.verification.map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'Giveaways', value: `${commandGroups.giveaways.map((name) => `\`/${name}\``).join('\n')}\n\`/giveaway-entry-add\` \`/giveaway-entry-remove\` \`/giveaway-blacklist\`\n\`/poll-start\``, inline: true },
        { name: 'Tickets', value: commandGroups.tickets.map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'CU tryouts + whitelist', value: [...commandGroups.rivals, ...commandGroups.whitelist].map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'CU economy', value: '`/balance` `/daily` `/coinflip` `/slots` `/dice` `/roulette` `/coin-leaderboard`', inline: true },
        { name: 'CU duels', value: '`/duel` `/duel-leaderboard` `/duel-result`', inline: true },
        { name: 'Tracking', value: `${commandGroups.tracking.map((name) => `\`/${name}\``).join('\n')}\nJoin/leave/invite embeds`, inline: true },
        { name: 'Message builder', value: commandGroups.messaging.map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'Moderation actions', value: '`/addrole` `/removerole` `/kick` `/ban` `/softban` `/unban` `/timeout` `/mute` `/deafen` `/move` `/lock` `/slowmode` `/clear`', inline: false },
        { name: 'Moderation records', value: '`/warn` `/warnings` `/warning-book` `/remove-warning` `/clear-warnings` `/userinfo` `/roleinfo` `/serverinfo`', inline: false },
        { name: 'Permissions', value: 'All commands check Discord permissions and role hierarchy. Setup, panels, giveaways, tickets, and moderation tools are staff-only.', inline: false },
      )
      .setFooter({ text: 'All configuration and giveaways survive restarts.' })],
  };
}

function responseEmbed(description, type = 'success') {
  const styles = {
    success: { color: 0x57f287, title: 'Success' },
    error: { color: 0xed4245, title: 'Something went wrong' },
    info: { color: 0x5865f2, title: 'Information' },
  };
  const style = styles[type];
  return new EmbedBuilder().setColor(style.color).setTitle(style.title).setDescription(description).setTimestamp();
}

async function replyPrivately(interaction, content, type = 'success') {
  const response = { embeds: [responseEmbed(content, type)], flags: MessageFlags.Ephemeral };
  if (interaction.deferred) return interaction.editReply({ embeds: response.embeds });
  return interaction.replied ? interaction.followUp(response) : interaction.reply(response);
}

function editPrivateReply(interaction, content, type = 'success') {
  return interaction.editReply({ embeds: [responseEmbed(content, type)] });
}

function requireAdminServer(interaction) {
  if (!interaction.guild || !interaction.guildId) throw new Error('This command can only be used in a server.');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('You need the Manage Server permission to use this command.');
}

function requireAdministrator(interaction) {
  if (!interaction.guild || !interaction.guildId) throw new Error('This command can only be used in a server.');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) throw new Error('You need Administrator permission to use this control.');
}

async function handleUserBlacklistCommand(interaction) {
  requireAdministrator(interaction);
  const config = ensureConfiguration(interaction.guildId);
  if (interaction.commandName === 'user-blacklist-list') {
    const entries = Object.entries(config.userBlacklist);
    if (!entries.length) return replyPrivately(interaction, 'The server user-ID blacklist is empty.', 'info');
    return replyPrivately(interaction, `🚫 **Blacklisted user IDs**\n\n${entries.map(([id, item]) => `\`${id}\` — ${item.reason || 'No reason provided'}`).join('\n')}`, 'info');
  }
  const userId = interaction.options.getString('user-id', true).trim();
  if (!/^\d{17,20}$/.test(userId)) throw new Error('Enter a valid Discord user ID (17-20 digits).');
  if (interaction.commandName === 'user-blacklist-add') {
    config.userBlacklist[userId] = { reason: interaction.options.getString('reason') || 'No reason provided', addedBy: interaction.user.id, addedAt: Date.now() };
    await saveConfigurations();
    return replyPrivately(interaction, `Added \`${userId}\` to this server’s blacklist.`, 'success');
  }
  delete config.userBlacklist[userId];
  await saveConfigurations();
  return replyPrivately(interaction, `Removed \`${userId}\` from this server’s blacklist.`, 'success');
}

function serverTemplateStore() {
  guildConfigurations.__serverTemplates ||= {};
  return guildConfigurations.__serverTemplates;
}

function accessControlStore() {
  guildConfigurations.__accessControl ||= { userBlacklist: {}, serverBlacklist: {}, approvedUsers: {}, approvedServers: {}, requests: {} };
  const store = guildConfigurations.__accessControl;
  store.userBlacklist ||= {};
  store.serverBlacklist ||= {};
  store.approvedUsers ||= {};
  store.approvedServers ||= {};
  store.requests ||= {};
  return store;
}

function requireBotOwner(interaction) {
  if (!BOT_OWNER_IDS.has(interaction.user.id)) throw new Error('Only the configured bot owners can use this command.');
}

function accessRequestButtons(requestId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${REQUEST_APPROVE_PREFIX}${requestId}`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${REQUEST_DENY_PREFIX}${requestId}`).setLabel('Deny').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
}

async function sendApprovalRequest(request) {
  const store = accessControlStore();
  store.requests[request.id] = request;
  await saveConfigurations();
  const embed = new EmbedBuilder().setColor(0xfee75c).setTitle('Bot Approval Request').setDescription(`A request was submitted by <@${request.requesterId}>.`).addFields({ name: 'Type', value: request.type, inline: true }, { name: 'Target ID', value: `\`${request.targetId}\``, inline: true }, { name: 'Reason', value: request.reason || 'No reason provided' }).setTimestamp();
  for (const ownerId of BOT_OWNER_IDS) {
    const owner = await client.users.fetch(ownerId).catch(() => null);
    if (owner) await owner.send({ embeds: [embed], components: [accessRequestButtons(request.id)] }).catch(() => undefined);
  }
}

async function handleAccessRequestCommand(interaction) {
  const type = interaction.options.getString('type', true);
  const targetId = interaction.options.getString('target-id', true).trim();
  if (!/^\d{17,20}$/.test(targetId)) throw new Error('Target ID must be a valid Discord ID.');
  const request = { id: randomBytes(5).toString('hex'), type, targetId, reason: interaction.options.getString('reason') || 'No reason provided', requesterId: interaction.user.id, createdAt: Date.now() };
  await sendApprovalRequest(request);
  return replyPrivately(interaction, 'Your request was sent successfully to the bot owners.', 'success');
}

async function handleGlobalBlacklistCommand(interaction) {
  requireBotOwner(interaction);
  const type = interaction.options.getString('type', true);
  const targetId = interaction.options.getString('target-id', true).trim();
  const action = interaction.options.getString('action', true);
  if (!/^\d{17,20}$/.test(targetId)) throw new Error('Target ID must be a valid Discord ID.');
  const store = accessControlStore();
  const list = type === 'user' ? store.userBlacklist : store.serverBlacklist;
  if (action === 'add') list[targetId] = { addedBy: interaction.user.id, addedAt: Date.now() };
  else delete list[targetId];
  await saveConfigurations();
  return replyPrivately(interaction, `${type === 'user' ? 'User' : 'Server'} ID \`${targetId}\` was ${action === 'add' ? 'added to' : 'removed from'} the global blacklist.`, 'success');
}

async function handleGlobalWhitelistCommand(interaction) {
  requireBotOwner(interaction);
  const type = interaction.options.getString('type', true);
  const action = interaction.options.getString('action', true);
  const store = accessControlStore();
  const list = type === 'user' ? store.approvedUsers : store.approvedServers;
  if (action === 'list') {
    const ids = Object.keys(list);
    return replyPrivately(interaction, ids.length ? `✅ Approved ${type} IDs:\n\n${ids.map((id) => `\`${id}\``).join('\n')}` : `No approved ${type} IDs.`, 'info');
  }
  const targetId = interaction.options.getString('target-id')?.trim();
  if (!targetId || !/^\d{17,20}$/.test(targetId)) throw new Error('Enter a valid target ID for add/remove.');
  if (action === 'add') list[targetId] = { approvedBy: interaction.user.id, approvedAt: Date.now() };
  else delete list[targetId];
  await saveConfigurations();
  return replyPrivately(interaction, `${type === 'user' ? 'User' : 'Server'} ID \`${targetId}\` was ${action === 'add' ? 'added to' : 'removed from'} the global whitelist.`, 'success');
}

async function handleCommandSearch(interaction) {
  requireBotOwner(interaction);
  const query = interaction.options.getString('query', true).toLowerCase();
  const category = interaction.options.getString('category');
  const categoryNames = category === 'moderation' ? [...organizedModerationCommandNames] : category && commandGroups[category] ? commandGroups[category] : null;
  const names = commands.map((command) => command.name).filter((name) => name.includes(query) && (!categoryNames || (categoryNames instanceof Set ? categoryNames.has(name) : categoryNames.includes(name))));
  return replyPrivately(interaction, names.length ? `🔎 Commands matching **${query}**:\n\n${names.map((name) => `\`/${name}\``).join('\n')}` : 'No commands matched that search.', 'info');
}

async function handleApprovalButton(interaction) {
  if (!BOT_OWNER_IDS.has(interaction.user.id)) throw new Error('Only the configured bot owners can approve or deny requests.');
  const approved = interaction.customId.startsWith(REQUEST_APPROVE_PREFIX);
  const prefix = approved ? REQUEST_APPROVE_PREFIX : REQUEST_DENY_PREFIX;
  const requestId = interaction.customId.slice(prefix.length);
  const store = accessControlStore();
  const request = store.requests[requestId];
  if (!request) throw new Error('This approval request has expired.');
  if (approved) {
    const list = request.type === 'user' ? store.approvedUsers : store.approvedServers;
    list[request.targetId] = { approvedBy: interaction.user.id, approvedAt: Date.now() };
  }
  delete store.requests[requestId];
  await saveConfigurations();
  await interaction.update({ embeds: [responseEmbed(`${request.type === 'user' ? 'User' : 'Server'} ID \`${request.targetId}\` was ${approved ? 'approved' : 'denied'}.`, approved ? 'success' : 'info')], components: [] });
}

async function handleServerTemplateCommand(interaction) {
  requireAdministrator(interaction);
  const templates = serverTemplateStore();
  if (interaction.commandName === 'server-copy' || interaction.commandName === 'server-config-copy') {
    const roles = [...interaction.guild.roles.cache.values()]
      .filter((role) => role.id !== interaction.guild.id && !role.managed)
      .sort((a, b) => a.position - b.position)
      .slice(0, 250)
      .map((role) => ({ name: role.name, color: role.hexColor, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions.bitfield.toString() }));
    const channels = [...interaction.guild.channels.cache.values()]
      .filter((channel) => [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type))
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .slice(0, 500)
      .map((channel) => ({
        name: channel.name,
        type: channel.type,
        parentName: channel.parent?.name || null,
        topic: 'topic' in channel ? channel.topic : null,
        nsfw: 'nsfw' in channel ? channel.nsfw : false,
        rateLimitPerUser: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0,
        permissionOverwrites: [...channel.permissionOverwrites.cache.values()].map((overwrite) => {
          const role = overwrite.type === 0 ? interaction.guild.roles.cache.get(overwrite.id) : null;
          return role ? { roleName: role.name, allow: overwrite.allow.bitfield.toString(), deny: overwrite.deny.bitfield.toString() } : null;
        }).filter(Boolean),
      }));
    const sourceConfig = guildConfigurations[interaction.guildId] || {};
    const roleName = (id) => id ? interaction.guild.roles.cache.get(id)?.name || null : null;
    const channelName = (id) => id ? interaction.guild.channels.cache.get(id)?.name || null : null;
    const botSettings = {
      tickets: {
        categoryName: channelName(sourceConfig.tickets?.categoryId), staffRoleName: roleName(sourceConfig.tickets?.staffRoleId), logChannelName: channelName(sourceConfig.tickets?.logChannelId), notificationChannelName: channelName(sourceConfig.tickets?.notificationChannelId), tryoutRoleName: roleName(sourceConfig.tickets?.tryoutRoleId), panel: sourceConfig.tickets?.panel || {}, rivalsPanel: sourceConfig.tickets?.rivalsPanel || {},
      },
      verification: { roleName: roleName(sourceConfig.verifiedRoleId), logChannelName: channelName(sourceConfig.logChannelId), panel: sourceConfig.panel || {} },
      whitelist: { roleName: roleName(sourceConfig.whitelist?.roleId), panel: sourceConfig.whitelist?.panel || {} },
      tracking: { channelName: channelName(sourceConfig.tracking?.channelId), panel: sourceConfig.tracking?.panel || {} },
    };
    const code = `TPL-${randomBytes(5).toString('hex').toUpperCase()}`;
    templates[code] = { createdBy: interaction.user.id, sourceGuild: interaction.guild.name, createdAt: Date.now(), roles, channels, botSettings };
    await saveConfigurations();
    return replyPrivately(interaction, `✅ Server template created. Use this code in the other server:\n\n\`${code}\`\n\nCopied **${roles.length} roles** and **${channels.length} channels/categories**.`, 'success');
  }
  const code = interaction.options.getString('code', true).trim().toUpperCase();
  const template = templates[code];
  if (!template) throw new Error('That server template code is invalid or expired.');
  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('I need Manage Roles and Manage Channels permissions to paste a server template.');
  const roleMap = new Map();
  for (const roleData of template.roles) {
    const role = await interaction.guild.roles.create({ name: roleData.name, color: roleData.color, hoist: roleData.hoist, mentionable: roleData.mentionable, permissions: BigInt(roleData.permissions), reason: `Server template ${code}` });
    roleMap.set(roleData.name, role);
  }
  const categoryMap = new Map();
  const channelMap = new Map();
  const orderedChannels = [...template.channels].sort((a, b) => (a.type === ChannelType.GuildCategory ? -1 : 1) - (b.type === ChannelType.GuildCategory ? -1 : 1));
  let created = 0;
  for (const data of orderedChannels) {
    const permissionOverwrites = data.permissionOverwrites.map((overwrite) => {
      const role = roleMap.get(overwrite.roleName);
      if (!role) return null;
      return { id: role.id, allow: BigInt(overwrite.allow), deny: BigInt(overwrite.deny) };
    }).filter(Boolean);
    const options = { name: data.name, type: data.type, reason: `Server template ${code}`, permissionOverwrites };
    if (data.type !== ChannelType.GuildCategory && data.parentName) options.parent = categoryMap.get(data.parentName)?.id;
    if (data.type === ChannelType.GuildText || data.type === ChannelType.GuildAnnouncement) { options.topic = data.topic || undefined; options.nsfw = data.nsfw; options.rateLimitPerUser = data.rateLimitPerUser || 0; }
    const channel = await interaction.guild.channels.create(options);
    if (data.type === ChannelType.GuildCategory) categoryMap.set(data.name, channel);
    channelMap.set(data.name, channel);
    created += 1;
  }
  const targetConfig = ensureConfiguration(interaction.guildId);
  const settings = template.botSettings;
  if (settings) {
    const ticketSettings = settings.tickets || {};
    targetConfig.tickets.categoryId = channelMap.get(ticketSettings.categoryName)?.id || null;
    targetConfig.tickets.staffRoleId = roleMap.get(ticketSettings.staffRoleName)?.id || null;
    targetConfig.tickets.logChannelId = channelMap.get(ticketSettings.logChannelName)?.id || null;
    targetConfig.tickets.notificationChannelId = channelMap.get(ticketSettings.notificationChannelName)?.id || null;
    targetConfig.tickets.tryoutRoleId = roleMap.get(ticketSettings.tryoutRoleName)?.id || null;
    targetConfig.tickets.panel = ticketSettings.panel || {};
    targetConfig.tickets.rivalsPanel = ticketSettings.rivalsPanel || {};
    targetConfig.verifiedRoleId = roleMap.get(settings.verification?.roleName)?.id || null;
    targetConfig.logChannelId = channelMap.get(settings.verification?.logChannelName)?.id || null;
    targetConfig.panel = settings.verification?.panel || {};
    targetConfig.whitelist.roleId = roleMap.get(settings.whitelist?.roleName)?.id || null;
    targetConfig.whitelist.panel = settings.whitelist?.panel || {};
    targetConfig.tracking.channelId = channelMap.get(settings.tracking?.channelName)?.id || null;
    targetConfig.tracking.panel = settings.tracking?.panel || {};
  }
  delete templates[code];
  await saveConfigurations();
  return replyPrivately(interaction, `✅ Template pasted successfully. Created **${roleMap.size} roles** and **${created} channels/categories**. The code is now consumed.`, 'success');
}

async function handleChannelAccessCommand(interaction) {
  if (!interaction.guild || !interaction.guildId) throw new Error('This command can only be used in a server.');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) throw new Error('You need Manage Channels permission to use this command.');
  const channel = interaction.options.getChannel('channel', true);
  const role = interaction.options.getRole('role');
  const action = interaction.options.getString('action');
  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('I need Manage Channels permission.');
  if (interaction.commandName === 'channel-access-list') {
    const lines = channel.permissionOverwrites.cache.filter((overwrite) => overwrite.type === 0).map((overwrite) => {
      const view = overwrite.allow.has(PermissionFlagsBits.ViewChannel) ? 'Allowed' : overwrite.deny.has(PermissionFlagsBits.ViewChannel) ? 'Denied' : 'Inherited';
      return `<@&${overwrite.id}> — **${view}**`;
    });
    return replyPrivately(interaction, `🔐 **Access for ${channel}**\n\n${lines.join('\n') || 'No role-specific access rules configured.'}`, 'info');
  }
  if (!role || !action) throw new Error('Choose a role and an access action.');
  if (role.managed || role.id === interaction.guild.id) throw new Error('Choose a normal, non-managed role.');
  if (action === 'allow') {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }, { reason: `Private access configured by ${interaction.user.tag}` });
    await channel.permissionOverwrites.edit(role, { ViewChannel: true, ReadMessageHistory: true, SendMessages: true }, { reason: `Access granted by ${interaction.user.tag}` });
    return replyPrivately(interaction, `${role} can now see and use ${channel}. @everyone was denied visibility.`, 'success');
  }
  await channel.permissionOverwrites.delete(role.id, `Access removed by ${interaction.user.tag}`);
  return replyPrivately(interaction, `Removed ${role}'s custom access rule from ${channel}.`, 'success');
}

async function handleMaintenanceCommand(interaction) {
  requireAdministrator(interaction);
  const category = interaction.options.getChannel('category', true);
  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('I need Manage Channels permission.');
  if (interaction.commandName === 'maintenance-lock') {
    const role = interaction.options.getRole('role', true);
    if (role.managed || role.id === interaction.guild.id) throw new Error('Choose a normal, non-managed maintenance role.');
    const targets = [category, ...category.children.cache.values()];
    for (const target of targets) {
      await target.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }, { reason: `Maintenance lock by ${interaction.user.tag}` });
      await target.permissionOverwrites.edit(role, { ViewChannel: true, ReadMessageHistory: true, SendMessages: true }, { reason: `Maintenance access by ${interaction.user.tag}` });
    }
    return replyPrivately(interaction, `🔒 ${category} is locked for maintenance. Only ${role} can see it and its channels.`, 'success');
  }
  const targets = [category, ...category.children.cache.values()];
  for (const target of targets) {
    await target.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null }, { reason: `Maintenance unlock by ${interaction.user.tag}` });
  }
  return replyPrivately(interaction, `🔓 Maintenance lock removed from ${category}.`, 'success');
}

function economyFor(guildId) {
  return ensureConfiguration(guildId).economy;
}

function economyBalance(guildId, userId) {
  const economy = economyFor(guildId);
  economy.balances[userId] = Math.max(0, Number(economy.balances[userId] ?? economy.startingBalance ?? 0));
  return economy.balances[userId];
}

function economyLabel(guildId, amount) {
  const economy = economyFor(guildId);
  return `${Number(amount).toLocaleString()} ${economy.emoji} ${economy.currency}`;
}

function duelStatsFor(guildId, userId) {
  const economy = economyFor(guildId);
  economy.duelStats[userId] ||= { wins: 0, losses: 0, duels: 0 };
  return economy.duelStats[userId];
}

function duelFormModal() {
  return new ModalBuilder()
    .setCustomId(DUEL_MODAL_ID)
    .setTitle('Your CU Duel Server')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('server-link').setLabel('Paste your private server link').setStyle(TextInputStyle.Short).setPlaceholder('https://www.roblox.com/share?...').setRequired(true).setMaxLength(500),
    ));
}

function duelButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${DUEL_ACCEPT_PREFIX}${id}`).setLabel('Accept Duel').setEmoji('⚔️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${DUEL_DECLINE_PREFIX}${id}`).setLabel('Decline').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );
}

async function sendDuelChallenge(interaction, payload, serverLink = null) {
  const id = randomBytes(5).toString('hex');
  const challenge = { ...payload, id, serverLink, accepted: [], declined: false, createdAt: Date.now() };
  pendingDuels.set(id, challenge);
  const opponentMentions = payload.opponents.map((userId) => `<@${userId}>`).join(', ');
  const warningLines = [];
  for (const userId of payload.opponents) {
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (member?.presence?.status === 'offline') warningLines.push(`<@${userId}> appears **offline**.`);
    if (member?.presence?.status === 'idle') warningLines.push(`<@${userId}> appears **idle**.`);
  }
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`⚔️ ${payload.mode} CU Duel Challenge`)
    .setDescription(`${interaction.user} challenged ${opponentMentions}. Every participant must accept in their DM.`)
    .addFields({ name: 'Challenger', value: `${interaction.user}`, inline: true }, { name: 'Opponents', value: opponentMentions, inline: true }, { name: 'Format', value: payload.mode, inline: true });
  if (serverLink) embed.addFields({ name: 'Private server', value: serverLink });
  if (warningLines.length) embed.addFields({ name: 'Availability warning', value: warningLines.join('\n') });
  embed.setFooter({ text: 'Accept in your DM from the bot. A private duel ticket opens after everyone accepts.' }).setTimestamp();
  await interaction.reply({ content: opponentMentions, embeds: [embed] });
  const participants = [payload.challengerId, ...payload.opponents];
  for (const userId of participants) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) continue;
    await user.send({ embeds: [embed], components: [duelButtons(id)] }).catch(() => undefined);
  }
  return null;
}

async function openDuelTicket(guild, challenge) {
  const tickets = ticketConfiguration(guild.id);
  if (!tickets?.categoryId || !tickets.staffRoleId) throw new Error('Set up tickets first with /setup-tickets so the duel chat can be created.');
  const { botMember } = await validateTicketSetup(guild, tickets);
  const participants = [challenge.challengerId, ...challenge.opponents];
  const channel = await guild.channels.create({
    name: `duel-${challenge.id}`,
    type: ChannelType.GuildText,
    parent: tickets.categoryId,
    topic: `${challenge.mode} CU duel • ${challenge.id}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...participants.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
      { id: tickets.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
    ],
  });
  const mentions = participants.map((id) => `<@${id}>`).join(' ');
  await channel.send({ content: `${mentions} <@&${tickets.staffRoleId}>`, embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('CU Duel Chat Opened').setDescription('All duel participants can coordinate here. Staff can moderate this private chat.').addFields({ name: 'Format', value: challenge.mode, inline: true }, { name: 'Server link', value: challenge.serverLink || 'The challenger did not provide a server link.' }).setTimestamp()] });
  return channel;
}

async function handleDuelButton(interaction) {
  const accepted = interaction.customId.startsWith(DUEL_ACCEPT_PREFIX);
  const id = interaction.customId.slice((accepted ? DUEL_ACCEPT_PREFIX : DUEL_DECLINE_PREFIX).length);
  const challenge = pendingDuels.get(id);
  if (!challenge) throw new Error('This duel challenge has expired.');
  const participants = [challenge.challengerId, ...challenge.opponents];
  if (!participants.includes(interaction.user.id)) throw new Error('You are not a participant in this duel.');
  if (!accepted) {
    challenge.declined = true;
    pendingDuels.delete(id);
    await interaction.update({ embeds: [responseEmbed(`${interaction.user} declined the duel.`, 'info')], components: [] });
    return;
  }
  if (!challenge.accepted.includes(interaction.user.id)) challenge.accepted.push(interaction.user.id);
  if (challenge.accepted.length < participants.length) {
    await interaction.update({ embeds: [responseEmbed(`You accepted. Waiting for ${participants.length - challenge.accepted.length} more participant(s).`, 'success')], components: [] });
    return;
  }
  pendingDuels.delete(id);
  const guild = await client.guilds.fetch(challenge.guildId);
  const channel = await openDuelTicket(guild, challenge);
  await interaction.update({ embeds: [responseEmbed(`Duel accepted! Your private chat is ${channel}.`, 'success')], components: [] });
}

async function handleDuelCommand(interaction) {
  if (interaction.commandName === 'duel') {
    const opponents = ['opponent', 'opponent2', 'opponent3'].map((name) => interaction.options.getUser(name)).filter(Boolean).map((user) => user.id);
    const mode = interaction.options.getString('mode', true);
    const requiredOpponents = { '1v1': 1, '2v1': 2, '2v2': 3 }[mode];
    if (opponents.length !== requiredOpponents) throw new Error(`${mode} requires exactly ${requiredOpponents} opponent user(s).`);
    if (new Set(opponents).size !== opponents.length || opponents.includes(interaction.user.id)) throw new Error('Each opponent must be a different member, and you cannot duel yourself.');
    const payload = { guildId: interaction.guildId, channelId: interaction.channelId, challengerId: interaction.user.id, opponents, mode };
    if (interaction.options.getBoolean('your-server')) {
      pendingDuels.set(`form:${interaction.user.id}`, payload);
      return interaction.showModal(duelFormModal());
    }
    return sendDuelChallenge(interaction, payload);
  }
  if (interaction.commandName === 'duel-leaderboard') {
    const stats = economyFor(interaction.guildId).duelStats;
    const rows = Object.entries(stats).sort((a, b) => (b[1].wins - a[1].wins) || (b[1].duels - a[1].duels)).slice(0, 10);
    if (!rows.length) return replyPrivately(interaction, 'No duel results have been recorded yet.', 'info');
    const lines = await Promise.all(rows.map(async ([id, item], index) => {
      const user = await client.users.fetch(id).catch(() => null);
      const rate = item.duels ? Math.round((item.wins / item.duels) * 100) : 0;
      return `**${index + 1}.** ${user?.username || `<@${id}>`} — **${item.wins}W / ${item.losses}L** • ${rate}% win rate`;
    }));
    return replyPrivately(interaction, `🏆 **Advanced CU Duel Leaderboard**\n\n${lines.join('\n')}`, 'info');
  }
  if (interaction.commandName === 'duel-result') {
    requireEconomyManager(interaction);
    const winner = interaction.options.getUser('winner', true);
    const loser = interaction.options.getUser('loser', true);
    if (winner.id === loser.id) throw new Error('Winner and loser must be different members.');
    duelStatsFor(interaction.guildId, winner.id).wins += 1;
    duelStatsFor(interaction.guildId, winner.id).duels += 1;
    duelStatsFor(interaction.guildId, loser.id).losses += 1;
    duelStatsFor(interaction.guildId, loser.id).duels += 1;
    await saveConfigurations();
    const resultText = `Recorded **${winner}** as the winner over **${loser}**.`;
    const duelChannel = interaction.channel?.name?.startsWith('duel-') && interaction.channel.deletable ? interaction.channel : null;
    if (duelChannel) {
      await duelChannel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🏆 Duel Complete').setDescription(`${winner} defeated ${loser}. This duel chat will close now.`).setTimestamp()] });
      await replyPrivately(interaction, `${resultText} Closing this duel ticket now.`, 'success');
      await duelChannel.delete(`Duel result recorded by ${interaction.user.tag}`);
      return;
    }
    return replyPrivately(interaction, resultText, 'success');
  }
  return false;
}

async function handleDuelModal(interaction) {
  const payload = pendingDuels.get(`form:${interaction.user.id}`);
  if (!payload) throw new Error('Your duel form expired. Please run /duel again.');
  pendingDuels.delete(`form:${interaction.user.id}`);
  const serverLink = interaction.fields.getTextInputValue('server-link').trim();
  if (!/^https?:\/\//i.test(serverLink)) throw new Error('Please submit a valid server link beginning with http:// or https://.');
  return sendDuelChallenge(interaction, payload, serverLink);
}

function requireEconomyManager(interaction) {
  if (!interaction.guild || !interaction.guildId) throw new Error('This command can only be used in a server.');
  if (!interaction.member?.roles?.cache?.has(GAMBLING_STAFF_ROLE_ID)) throw new Error('You need the configured economy manager role to change member balances.');
}

async function handleEconomyCommand(interaction) {
  const { commandName } = interaction;
  if (commandName === 'balance') {
    const user = interaction.options.getUser('user') || interaction.user;
    return replyPrivately(interaction, `🪙 **${user.username}** has **${economyBalance(interaction.guildId, user.id).toLocaleString()} CU coins**.`, 'info');
  }
  if (commandName === 'daily') {
    const economy = economyFor(interaction.guildId);
    const last = Number(economy.daily[interaction.user.id] || 0);
    const cooldown = 24 * 60 * 60 * 1000;
    if (Date.now() - last < cooldown) {
      const next = Math.ceil((last + cooldown) / 1000);
      throw new Error(`You already claimed daily coins. Try again <t:${next}:R>.`);
    }
    economy.daily[interaction.user.id] = Date.now();
    economy.balances[interaction.user.id] = economyBalance(interaction.guildId, interaction.user.id) + economy.dailyAmount;
    await saveConfigurations();
    return replyPrivately(interaction, `🎁 You claimed **${economyLabel(interaction.guildId, economy.dailyAmount)}** for today!`, 'success');
  }
  if (commandName === 'coin-leaderboard') {
    const economy = economyFor(interaction.guildId);
    const rows = Object.entries(economy.balances).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!rows.length) return replyPrivately(interaction, 'No CU coin balances exist yet.', 'info');
    const lines = await Promise.all(rows.map(async ([id, amount], index) => {
      const user = await client.users.fetch(id).catch(() => null);
      return `**${index + 1}.** ${user ? user.username : `<@${id}>`} — **${Number(amount).toLocaleString()}** 🪙`;
    }));
    return replyPrivately(interaction, `🏆 **CU Coin Leaderboard**\n\n${lines.join('\n')}`, 'info');
  }
  if (commandName === 'economy-add' || commandName === 'economy-remove') {
    requireEconomyManager(interaction);
    const user = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const economy = economyFor(interaction.guildId);
    const before = economyBalance(interaction.guildId, user.id);
    const after = commandName === 'economy-add' ? before + amount : Math.max(0, before - amount);
    economy.balances[user.id] = after;
    await saveConfigurations();
    const verb = commandName === 'economy-add' ? 'added to' : 'removed from';
    return replyPrivately(interaction, `🪙 **${amount.toLocaleString()}** coins ${verb} ${user}. New balance: **${after.toLocaleString()}**.\nReason: ${interaction.options.getString('reason') || 'No reason provided.'}`);
  }
  if (commandName === 'economy-config') {
    requireEconomyManager(interaction);
    const economy = economyFor(interaction.guildId);
    const updates = {
      currency: interaction.options.getString('currency'),
      emoji: interaction.options.getString('emoji'),
      dailyAmount: interaction.options.getInteger('daily-amount'),
      startingBalance: interaction.options.getInteger('starting-balance'),
      maxBet: interaction.options.getInteger('max-bet'),
      color: interaction.options.getString('color'),
    };
    if (updates.color) parseColor(updates.color, 0);
    if (!Object.values(updates).some((value) => value !== null)) throw new Error('Choose at least one economy setting to change.');
    Object.assign(economy, Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== null)));
    await saveConfigurations();
    return replyPrivately(interaction, `Economy updated. Currency: **${economy.emoji} ${economy.currency}** • Daily: **${economy.dailyAmount}** • Max bet: **${economy.maxBet}**`, 'success');
  }
  if (commandName === 'economy-reset') {
    requireEconomyManager(interaction);
    const economy = economyFor(interaction.guildId);
    const user = interaction.options.getUser('user');
    if (user) economy.balances[user.id] = economy.startingBalance;
    else economy.balances = {};
    await saveConfigurations();
    return replyPrivately(interaction, user ? `Reset ${user}'s balance to **${economyLabel(interaction.guildId, economy.startingBalance)}**.` : 'Reset every member balance.');
  }
  if (['coinflip', 'slots', 'dice', 'roulette'].includes(commandName)) {
    const amount = interaction.options.getInteger('amount', true);
    const economy = economyFor(interaction.guildId);
    if (amount > economy.maxBet) throw new Error(`The maximum bet is **${economyLabel(interaction.guildId, economy.maxBet)}**.`);
    const balance = economyBalance(interaction.guildId, interaction.user.id);
    if (amount > balance) throw new Error(`You only have **${balance.toLocaleString()}** CU coins.`);
    let won = false;
    let payout = 0;
    let resultText;
    if (commandName === 'coinflip') {
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      won = result === interaction.options.getString('side', true);
      payout = won ? amount * 2 : 0;
      resultText = `The coin landed on **${result}**.`;
    } else if (commandName === 'slots') {
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
      const spin = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
      const unique = new Set(spin).size;
      won = unique === 1 || unique === 2;
      payout = unique === 1 ? amount * 5 : unique === 2 ? amount * 2 : 0;
      resultText = `${spin.join(' | ')}\n${unique === 1 ? 'JACKPOT!' : unique === 2 ? 'Two of a kind!' : 'No match this time.'}`;
    } else if (commandName === 'dice') {
      const roll = Math.floor(Math.random() * 6) + 1;
      const guess = interaction.options.getInteger('guess', true);
      won = roll === guess;
      payout = won ? amount * 5 : 0;
      resultText = `The die rolled **${roll}**. You guessed **${guess}**.`;
    } else {
      const result = Math.floor(Math.random() * 37);
      const guess = interaction.options.getInteger('number', true);
      won = result === guess;
      payout = won ? amount * 36 : 0;
      resultText = `Roulette landed on **${result}**. You picked **${guess}**.`;
    }
    economy.balances[interaction.user.id] = balance - amount + payout;
    await saveConfigurations();
    const net = payout - amount;
    const gameName = commandName === 'coinflip' ? '🪙 **Coin Flip**' : commandName === 'slots' ? '🎰 **CU Slots**' : commandName === 'dice' ? '🎲 **Lucky Dice**' : '🎯 **Roulette**';
    return replyPrivately(interaction, `${gameName}\n${resultText}\n\n${won ? `You won **${economyLabel(interaction.guildId, payout)}**!` : `You lost **${economyLabel(interaction.guildId, amount)}**.`}\nBalance: **${economyLabel(interaction.guildId, economy.balances[interaction.user.id])}** (${net >= 0 ? '+' : ''}${net.toLocaleString()})`, won ? 'success' : 'info');
  }
  return false;
}

async function validateRole(guild, roleId) {
  const role = await guild.roles.fetch(roleId);
  const botMember = await guild.members.fetchMe();
  if (!role || role.id === guild.id || role.managed) throw new Error('Choose a normal server role, not @everyone or an integration role.');
  if (role.permissions.has(PermissionFlagsBits.Administrator)) throw new Error('For safety, the verified role cannot have Administrator.');
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('I need the Manage Roles permission.');
  if (botMember.roles.highest.comparePositionTo(role) <= 0) throw new Error('Move my bot role above the verified role in Server Settings → Roles.');
  return role;
}

function requireTextChannel(channel) {
  if (!channel?.isTextBased() || channel.isDMBased()) throw new Error('Choose a server text or announcement channel.');
  return channel;
}

async function canPost(guild, channel) {
  const botMember = await guild.members.fetchMe();
  if (!channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new Error(`I need View Channel, Send Messages, and Embed Links in ${channel}.`);
  }
}

async function handleSetup(interaction) {
  requireAdminServer(interaction);
  const role = interaction.options.getRole('role', true);
  await validateRole(interaction.guild, role.id);
  const config = ensureConfiguration(interaction.guildId);
  config.verifiedRoleId = role.id;
  config.logChannelId = interaction.options.getChannel('log-channel')?.id || null;
  await saveConfigurations();
  return replyPrivately(interaction, `Verification is configured. Members will receive ${role}.`);
}

async function handleCustomize(interaction) {
  requireAdminServer(interaction);
  const config = ensureConfiguration(interaction.guildId);
  const fields = {
    title: interaction.options.getString('title'),
    description: interaction.options.getString('description'),
    color: interaction.options.getString('color'),
    buttonLabel: interaction.options.getString('button-label'),
    buttonEmoji: interaction.options.getString('button-emoji'),
    footer: interaction.options.getString('footer'),
  };
  if (!Object.values(fields).some(Boolean)) throw new Error('Choose at least one setting to customize.');
  if (fields.color) parseColor(fields.color, 0);
  Object.assign(config.panel, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)));
  await saveConfigurations();
  return replyPrivately(interaction, 'Verification panel customization saved. Run /verification-panel to post it.');
}

async function handlePanel(interaction) {
  requireAdminServer(interaction);
  const config = configuration(interaction.guildId);
  if (!config?.verifiedRoleId) throw new Error('Run /setup-verification first.');
  await validateRole(interaction.guild, config.verifiedRoleId);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await canPost(interaction.guild, channel);
  await channel.send(verificationPanel(config.panel));
  return replyPrivately(interaction, `Verification panel posted in ${channel}.`);
}

function whitelistConfiguration(guildId) {
  return configuration(guildId)?.whitelist || null;
}

async function validateWhitelistSetup(guild) {
  const whitelist = whitelistConfiguration(guild.id);
  if (!whitelist?.roleId) throw new Error('Run /setup-whitelist first.');
  const role = await validateRole(guild, whitelist.roleId);
  return { whitelist, role };
}

async function handleSetupWhitelist(interaction) {
  requireAdminServer(interaction);
  const role = interaction.options.getRole('role', true);
  await validateRole(interaction.guild, role.id);
  const config = ensureConfiguration(interaction.guildId);
  config.whitelist.roleId = role.id;
  await saveConfigurations();
  return replyPrivately(interaction, `Whitelist is configured. Redeemed keys will grant ${role}.`);
}

async function handleCustomizeWhitelist(interaction) {
  requireAdminServer(interaction);
  const config = ensureConfiguration(interaction.guildId);
  const fields = {
    title: interaction.options.getString('title'),
    description: interaction.options.getString('description'),
    color: interaction.options.getString('color'),
    buttonLabel: interaction.options.getString('button-label'),
    footer: interaction.options.getString('footer'),
  };
  if (!Object.values(fields).some(Boolean)) throw new Error('Choose at least one setting to customize.');
  if (fields.color) parseColor(fields.color, 0);
  Object.assign(config.whitelist.panel, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)));
  await saveConfigurations();
  return replyPrivately(interaction, 'Whitelist panel customization saved.');
}

async function handleWhitelistPanel(interaction) {
  requireAdminServer(interaction);
  await validateWhitelistSetup(interaction.guild);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await canPost(interaction.guild, channel);
  await channel.send(whitelistPanel(whitelistConfiguration(interaction.guildId).panel));
  return replyPrivately(interaction, `Whitelist panel posted in ${channel}.`);
}

function newWhitelistKey() {
  return `WL-${randomBytes(9).toString('base64url').toUpperCase()}`;
}

async function handleWhitelistKeyGenerate(interaction) {
  requireAdminServer(interaction);
  const { whitelist } = await validateWhitelistSetup(interaction.guild);
  const amount = interaction.options.getInteger('amount', true);
  const keys = [];
  for (let index = 0; index < amount; index += 1) {
    let key = newWhitelistKey();
    while (whitelist.keys[key]) key = newWhitelistKey();
    whitelist.keys[key] = { createdAt: Date.now(), usedBy: null, usedAt: null };
    keys.push(key);
  }
  await saveConfigurations();
  return replyPrivately(interaction, `Generated **${keys.length}** whitelist key${keys.length === 1 ? '' : 's'}. Keep these private:\n\n${keys.map((key) => `\`${key}\``).join('\n')}`);
}

function whitelistKeyModal() {
  return new ModalBuilder()
    .setCustomId(WHITELIST_MODAL_ID)
    .setTitle('Redeem Whitelist Key')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('key').setLabel('Whitelist key').setPlaceholder('WL-XXXXXXXXXXXX').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40),
    ));
}

async function handleWhitelistButton(interaction) {
  if (!interaction.guildId) return replyPrivately(interaction, 'Whitelist keys can only be redeemed in a server.', 'error');
  await validateWhitelistSetup(interaction.guild);
  return interaction.showModal(whitelistKeyModal());
}

async function handleWhitelistRedeem(interaction) {
  const { whitelist, role } = await validateWhitelistSetup(interaction.guild);
  const key = interaction.fields.getTextInputValue('key').trim().toUpperCase();
  const entry = whitelist.keys[key];
  if (!entry) throw new Error('That whitelist key is invalid.');
  if (entry.usedBy) throw new Error('That whitelist key has already been redeemed.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) return editPrivateReply(interaction, `You already have the ${role.name} role.`, 'info');
  await member.roles.add(role, `Whitelist key redeemed: ${key}`);
  entry.usedBy = interaction.user.id;
  entry.usedAt = Date.now();
  await saveConfigurations();
  return editPrivateReply(interaction, `Whitelist key accepted! You now have the ${role.name} role.`);
}

async function handleDirectWhitelist(interaction, remove = false) {
  requireAdminServer(interaction);
  const { role } = await validateWhitelistSetup(interaction.guild);
  const user = interaction.options.getUser('user', true);
  const member = await interaction.guild.members.fetch(user.id);
  if (remove) {
    await member.roles.remove(role, 'Removed from whitelist by staff');
    return replyPrivately(interaction, `Removed the ${role.name} role from ${user}.`);
  }
  await member.roles.add(role, 'Directly whitelisted by staff');
  return replyPrivately(interaction, `Directly whitelisted ${user} with the ${role.name} role.`);
}

function trackingConfiguration(guildId) {
  return configuration(guildId)?.tracking || null;
}

async function handleSetupTracking(interaction) {
  requireAdminServer(interaction);
  if (!trackingIntentsEnabled) throw new Error('Enable Server Members Intent and Guild Invites Intent, then set ENABLE_TRACKING_INTENTS=true in .env and restart the bot.');
  const channel = requireTextChannel(interaction.options.getChannel('channel', true));
  await canPost(interaction.guild, channel);
  const config = ensureConfiguration(interaction.guildId);
  config.tracking.channelId = channel.id;
  await saveConfigurations();
  return replyPrivately(interaction, `Join and leave tracking will now be posted in ${channel}.`);
}

async function handleCustomizeTracking(interaction) {
  requireAdminServer(interaction);
  const config = ensureConfiguration(interaction.guildId);
  const fields = {
    joinTitle: interaction.options.getString('join-title'),
    joinDescription: interaction.options.getString('join-description'),
    leaveTitle: interaction.options.getString('leave-title'),
    leaveDescription: interaction.options.getString('leave-description'),
    color: interaction.options.getString('color'),
  };
  if (!Object.values(fields).some(Boolean)) throw new Error('Choose at least one setting to customize.');
  if (fields.color) parseColor(fields.color, 0);
  Object.assign(config.tracking.panel, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)));
  await saveConfigurations();
  return replyPrivately(interaction, 'Member tracking customization saved.');
}

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Map(invites.map((invite) => [invite.code, { uses: invite.uses || 0, inviter: invite.inviter }])));
  } catch (error) {
    console.error(`Could not cache invites for ${guild.name}:`, error.message);
  }
}

function trackingText(value, replacements, fallback) {
  return (value || fallback).replace(/\{(user|member|invite|count)\}/g, (_, key) => replacements[key] || 'unknown');
}

async function sendMemberTracking(member, joined, invite) {
  const config = trackingConfiguration(member.guild.id);
  if (!config?.channelId) return;
  const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const panel = config.panel || {};
  const replacements = {
    user: `${member.user}`,
    member: member.user.tag,
    invite: invite ? `${invite.code}${invite.inviter ? ` (by ${invite.inviter.tag})` : ''}` : 'unknown invite',
    count: String(member.guild.memberCount),
  };
  const embed = new EmbedBuilder()
    .setColor(parseColor(panel.color, joined ? 0x57f287 : 0xed4245))
    .setTitle(trackingText(joined ? panel.joinTitle : panel.leaveTitle, replacements, joined ? 'Member Joined' : 'Member Left'))
    .setDescription(trackingText(joined ? panel.joinDescription : panel.leaveDescription, replacements, joined ? `${member} joined the server.` : `**${member.user.tag}** left the server.`))
    .addFields(
      { name: 'Member', value: `${member.user.tag}\n${member.id}`, inline: true },
      ...(joined ? [{ name: 'Invited with', value: replacements.invite, inline: true }] : []),
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch((error) => console.error('Could not send member tracking embed:', error.message));
}

async function handleMemberJoin(member) {
  let usedInvite = null;
  try {
    const before = inviteCache.get(member.guild.id) || new Map();
    const current = await member.guild.invites.fetch();
    for (const invite of current.values()) {
      const old = before.get(invite.code);
      if (!old || (invite.uses || 0) > old.uses) {
        usedInvite = invite;
        break;
      }
    }
    inviteCache.set(member.guild.id, new Map(current.map((invite) => [invite.code, { uses: invite.uses || 0, inviter: invite.inviter }])));
  } catch (error) {
    console.error(`Could not identify invite for ${member.user.tag}:`, error.message);
  }
  await sendMemberTracking(member, true, usedInvite);
}

function getEmbedTheme(guild, name) {
  const requested = (name || 'default').trim().toLowerCase();
  if (requested === 'default') return { color: 0x5865f2, footer: 'Server announcement', author: null };
  const theme = configuration(guild.id)?.themes?.[requested];
  if (!theme) throw new Error(`Theme \`${requested}\` does not exist. Use /embed-theme-list.`);
  return theme;
}

async function handleEmbedThemeSave(interaction) {
  requireAdminServer(interaction);
  const name = interaction.options.getString('name', true).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  const colorText = interaction.options.getString('color', true);
  const config = ensureConfiguration(interaction.guildId);
  config.themes[name] = {
    color: parseColor(colorText, 0x5865f2),
    footer: interaction.options.getString('footer') || null,
    author: interaction.options.getString('author') || null,
  };
  await saveConfigurations();
  return replyPrivately(interaction, `Saved the custom embed theme \`${name}\`.`);
}

async function handleEmbedThemeList(interaction) {
  requireAdminServer(interaction);
  const themes = Object.keys(configuration(interaction.guildId)?.themes || {});
  return replyPrivately(interaction, themes.length ? `Saved themes:\n${themes.map((name) => `• \`${name}\``).join('\n')}` : 'No custom themes saved yet. The built-in `default` theme is always available.', 'info');
}

function buildMessagePayload(interaction) {
  const content = interaction.options.getString('content');
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const image = interaction.options.getAttachment('image');
  const file = interaction.options.getAttachment('file');
  if (!content && !title && !description && !image && !file) throw new Error('Add content, embed title/description, or a file.');
  const hasEmbed = Boolean(title || description || image);
  const theme = hasEmbed ? getEmbedTheme(interaction.guild, interaction.options.getString('theme')) : null;
  const overrideColor = interaction.options.getString('color');
  const embed = hasEmbed ? new EmbedBuilder().setColor(parseColor(overrideColor, theme.color)) : null;
  if (embed && title) embed.setTitle(title);
  if (embed && description) embed.setDescription(description);
  const footer = interaction.options.getString('footer') || theme?.footer;
  const author = interaction.options.getString('author') || theme?.author;
  if (embed && footer) embed.setFooter({ text: footer });
  if (embed && author) embed.setAuthor({ name: author });
  if (embed && interaction.options.getBoolean('timestamp')) embed.setTimestamp();
  const files = [];
  if (image) {
    files.push({ attachment: image.url, name: image.name });
    if (embed) embed.setImage(`attachment://${image.name}`);
  }
  if (file) files.push({ attachment: file.url, name: file.name });
  return { content: content || undefined, embeds: embed ? [embed] : [], files };
}

async function validateMessageBuilderChannel(guild, channel) {
  await canPost(guild, channel);
  const botMember = await guild.members.fetchMe();
  if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.AttachFiles)) throw new Error(`I need Attach Files in ${channel}.`);
}

async function handleMessageBuilder(interaction) {
  requireAdminServer(interaction);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await validateMessageBuilderChannel(interaction.guild, channel);
  await channel.send(buildMessagePayload(interaction));
  return replyPrivately(interaction, `Message sent to ${channel}.`);
}

async function handleMessageEdit(interaction) {
  requireAdminServer(interaction);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await validateMessageBuilderChannel(interaction.guild, channel);
  const message = await channel.messages.fetch(interaction.options.getString('message-id', true)).catch(() => null);
  if (!message) throw new Error('I could not find that message in the selected channel.');
  if (message.author.id !== client.user.id) throw new Error('For safety, only messages sent by this bot can be edited.');
  await message.edit(buildMessagePayload(interaction));
  return replyPrivately(interaction, `Message edited in ${channel}.`);
}

function requireModerationPermission(interaction, permission) {
  if (!interaction.guild || !interaction.guildId) throw new Error('This moderation command only works in a server.');
  if (!interaction.memberPermissions?.has(permission)) throw new Error('You do not have permission to use this moderation command.');
}

async function moderationMember(interaction) {
  const member = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
  const bot = await interaction.guild.members.fetchMe();
  if (member.id === interaction.user.id) throw new Error('You cannot moderate yourself.');
  if (member.id === bot.id || member.roles.highest.comparePositionTo(bot.roles.highest) >= 0) throw new Error('That member is above my role hierarchy.');
  return member;
}

function moderationReason(interaction) {
  return interaction.options.getString('reason') || `Moderator: ${interaction.user.tag}`;
}

async function handleModerationCommand(interaction) {
  const name = interaction.commandName;
  if (['addrole', 'removerole'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageRoles);
    const member = await moderationMember(interaction);
    const role = interaction.options.getRole('role', true);
    const bot = await interaction.guild.members.fetchMe();
    if (role.managed || role.id === interaction.guild.id || bot.roles.highest.comparePositionTo(role) <= 0) throw new Error('That role cannot be managed by me.');
    if (name === 'addrole') await member.roles.add(role, moderationReason(interaction));
    else await member.roles.remove(role, moderationReason(interaction));
    return replyPrivately(interaction, `${name === 'addrole' ? 'Added' : 'Removed'} ${role} ${name === 'addrole' ? 'to' : 'from'} ${member}.`);
  }
  if (['kick', 'ban', 'softban'].includes(name)) {
    requireModerationPermission(interaction, name === 'kick' ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.BanMembers);
    const member = await moderationMember(interaction);
    const reason = moderationReason(interaction);
    if (name === 'kick') await member.kick(reason);
    else { await member.ban({ deleteMessageSeconds: (interaction.options.getInteger('delete-days') || 0) * 86400, reason }); if (name === 'softban') await interaction.guild.bans.remove(member.id, reason); }
    return replyPrivately(interaction, `${name} completed for ${member}.`);
  }
  if (name === 'unban') {
    requireModerationPermission(interaction, PermissionFlagsBits.BanMembers);
    await interaction.guild.bans.remove(interaction.options.getString('user-id', true), moderationReason(interaction));
    return replyPrivately(interaction, 'User unbanned.');
  }
  if (['timeout', 'mute', 'untimeout', 'unmute'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.ModerateMembers);
    const member = await moderationMember(interaction);
    if (['timeout', 'mute'].includes(name)) await member.timeout(interaction.options.getInteger('minutes', true) * 60_000, moderationReason(interaction));
    else await member.timeout(null, moderationReason(interaction));
    return replyPrivately(interaction, `${name} completed for ${member}.`);
  }
  if (name === 'warn') {
    requireModerationPermission(interaction, PermissionFlagsBits.ModerateMembers);
    const member = await moderationMember(interaction);
    const config = ensureConfiguration(interaction.guildId);
    config.warnings[member.id] ||= [];
    config.warnings[member.id].push({ id: `W-${randomBytes(4).toString('hex').toUpperCase()}`, reason: interaction.options.getString('reason', true), moderator: interaction.user.id, at: Date.now() });
    await saveConfigurations();
    return replyPrivately(interaction, `${member} has been warned. Warning ID: \`${config.warnings[member.id].at(-1).id}\`\nWarning count: ${config.warnings[member.id].length}.`);
  }
  if (name === 'remove-warning') {
    requireModerationPermission(interaction, PermissionFlagsBits.ModerateMembers);
    const user = interaction.options.getUser('user', true);
    const config = ensureConfiguration(interaction.guildId);
    const warningId = interaction.options.getString('warning-id', true).toUpperCase();
    const list = config.warnings[user.id] || [];
    const index = list.findIndex((warning, warningIndex) => (warning.id || `W-${warningIndex + 1}`) === warningId);
    if (index < 0) throw new Error(`No warning with ID \`${warningId}\` was found for ${user}.`);
    list.splice(index, 1);
    await saveConfigurations();
    return replyPrivately(interaction, `Removed warning \`${warningId}\` from ${user}.`);
  }
  if (['warnings', 'warning-book', 'clear-warnings'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.ModerateMembers);
    const user = interaction.options.getUser('user', true);
    const config = ensureConfiguration(interaction.guildId);
    if (name === 'clear-warnings') { delete config.warnings[user.id]; await saveConfigurations(); return replyPrivately(interaction, `Cleared warnings for ${user}.`); }
    const list = config.warnings[user.id] || [];
    return replyPrivately(interaction, list.length ? `${user} has **${list.length}** warning(s).\n\n${list.map((item, index) => `**${item.id || `W-${index + 1}`}** • <t:${Math.floor(item.at / 1000)}:d>\n${item.reason}`).join('\n\n')}` : `${user} has no warnings.`, 'info');
  }
  if (['clear', 'purge'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageMessages);
    const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
    const deleted = await channel.bulkDelete(interaction.options.getInteger('amount', true), true);
    return replyPrivately(interaction, `Deleted ${deleted.size} message(s) from ${channel}.`);
  }
  if (['lock', 'unlock', 'hide', 'unhide'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageChannels);
    const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
    const everyone = interaction.guild.roles.everyone;
    if (name === 'lock' || name === 'unlock') await channel.permissionOverwrites.edit(everyone, { SendMessages: name === 'lock' ? false : null });
    else await channel.permissionOverwrites.edit(everyone, { ViewChannel: name === 'hide' ? false : null });
    return replyPrivately(interaction, `${channel} ${name} completed.`);
  }
  if (name === 'slowmode') {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageChannels);
    const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
    await channel.setRateLimitPerUser(interaction.options.getInteger('seconds', true));
    return replyPrivately(interaction, `Slowmode updated in ${channel}.`);
  }
  if (['setnick', 'resetnick'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageNicknames);
    const member = await moderationMember(interaction);
    await member.setNickname(name === 'setnick' ? interaction.options.getString('nickname', true) : null, moderationReason(interaction));
    return replyPrivately(interaction, `Nickname ${name === 'setnick' ? 'updated' : 'reset'} for ${member}.`);
  }
  if (['deafen', 'undeafen'].includes(name)) {
    requireModerationPermission(interaction, PermissionFlagsBits.DeafenMembers);
    const member = await moderationMember(interaction);
    if (!member.voice.channel) throw new Error('That member is not in a voice channel.');
    await member.voice.setDeaf(name === 'deafen', moderationReason(interaction));
    return replyPrivately(interaction, `${name} completed for ${member}.`);
  }
  if (name === 'move') {
    requireModerationPermission(interaction, PermissionFlagsBits.MoveMembers);
    const member = await moderationMember(interaction);
    const channel = interaction.options.getChannel('channel', true);
    await member.voice.setChannel(channel, moderationReason(interaction));
    return replyPrivately(interaction, `Moved ${member} to ${channel}.`);
  }
  if (name === 'roleinfo') {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageRoles);
    const role = interaction.options.getRole('role', true);
    return replyPrivately(interaction, `**${role.name}**\nID: \`${role.id}\`\nMembers: **${role.members.size}**\nPosition: **${role.position}**`, 'info');
  }
  if (name === 'userinfo') {
    requireModerationPermission(interaction, PermissionFlagsBits.ModerateMembers);
    const member = await moderationMember(interaction);
    return replyPrivately(interaction, `**${member.user.tag}**\nID: \`${member.id}\`\nJoined: <t:${Math.floor(member.joinedTimestamp / 1000)}:F>\nRoles: ${member.roles.cache.filter((role) => role.id !== interaction.guild.id).map((role) => role.name).join(', ') || 'None'}`, 'info');
  }
  if (name === 'serverinfo') {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageGuild);
    return replyPrivately(interaction, `**${interaction.guild.name}**\nMembers: **${interaction.guild.memberCount}**\nChannels: **${interaction.guild.channels.cache.size}**\nRoles: **${interaction.guild.roles.cache.size}**`, 'info');
  }
  if (name === 'announce') {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageMessages);
    const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
    await canPost(interaction.guild, channel);
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(interaction.options.getString('title', true)).setDescription(interaction.options.getString('message', true)).setFooter({ text: `Posted by ${interaction.user.tag}` }).setTimestamp()] });
    return replyPrivately(interaction, `Announcement sent to ${channel}.`);
  }
  if (name === 'say') {
    requireModerationPermission(interaction, PermissionFlagsBits.ManageMessages);
    const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
    await canPost(interaction.guild, channel);
    await channel.send({ content: interaction.options.getString('message', true) });
    return replyPrivately(interaction, `Message sent to ${channel}.`);
  }
  throw new Error('Unknown moderation command.');
}

function ticketConfiguration(guildId) {
  return configuration(guildId)?.tickets || null;
}

async function validateTicketSetup(guild, tickets) {
  if (!tickets?.categoryId || !tickets.staffRoleId) throw new Error('Run /setup-tickets before posting or using ticket panels.');
  const [category, staffRole, botMember] = await Promise.all([
    guild.channels.fetch(tickets.categoryId),
    guild.roles.fetch(tickets.staffRoleId),
    guild.members.fetchMe(),
  ]);
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error('The configured ticket category no longer exists. Run /setup-tickets again.');
  if (!staffRole) throw new Error('The configured staff role no longer exists. Run /setup-tickets again.');
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('I need the Manage Channels permission to create private tickets.');
  return { category, staffRole, botMember };
}

function safeChannelName(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'member';
}

async function ticketLog(guild, tickets, title, description, type = 'info') {
  if (!tickets.logChannelId) return;
  const channel = await guild.channels.fetch(tickets.logChannelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [responseEmbed(`${title}\n\n${description}`, type)] }).catch(() => undefined);
}

async function createTicket(interaction, { type, details = [] }) {
  if (!interaction.guild || !interaction.guildId) throw new Error('Tickets can only be created in a server.');
  const config = ensureConfiguration(interaction.guildId);
  const tickets = config.tickets;
  const existing = tickets.open[interaction.user.id];
  if (existing && !existing.closed) throw new Error(`You already have an open ticket: <#${existing.channelId}>.`);
  const { botMember } = await validateTicketSetup(interaction.guild, tickets);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = await interaction.guild.channels.create({
    name: `${type === CU_TRYOUT_TICKET_TYPE ? 'cu-tryout' : 'ticket'}-${safeChannelName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: tickets.categoryId,
    topic: `${type} • Owner: ${interaction.user.id}`,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: tickets.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
    ],
  });
  const ticket = { channelId: channel.id, ownerId: interaction.user.id, ownerMention: `${interaction.user}`, type, createdAt: Date.now(), closed: false };
  tickets.open[interaction.user.id] = ticket;
  await saveConfigurations();
  await channel.send({ content: `${interaction.user} <@&${tickets.staffRoleId}>`, embeds: [ticketWelcomeEmbed(ticket)], components: ticketCloseComponents() });
  await channel.send(ticket.type === CU_TRYOUT_TICKET_TYPE ? tryoutControlPanel() : ticketControlPanel());
  if (details.length) {
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('CU Tryout Application Details').setDescription(`${interaction.user} applied for a CU tryout. Staff, please review the details below.`).addFields(details).setTimestamp()],
    });
  }
  await ticketLog(interaction.guild, tickets, 'Ticket Opened', `${interaction.user} opened **${type}** in ${channel}.`);
  return editPrivateReply(interaction, `Your private ticket has been created: ${channel}.`);
}

async function handleSetupTickets(interaction) {
  requireAdminServer(interaction);
  const category = interaction.options.getChannel('category', true);
  const staffRole = interaction.options.getRole('staff-role', true);
  if (staffRole.id === interaction.guild.id || staffRole.managed) throw new Error('Choose a normal staff role.');
  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('I need the Manage Channels permission to create tickets.');
  const config = ensureConfiguration(interaction.guildId);
  config.tickets.categoryId = category.id;
  config.tickets.staffRoleId = staffRole.id;
  const tryoutRole = interaction.options.getRole('tryout-role');
  if (tryoutRole?.managed || tryoutRole?.id === interaction.guild.id) throw new Error('Choose a normal, non-managed tryout role.');
  if (tryoutRole) {
    const botMemberForRole = await interaction.guild.members.fetchMe();
    if (!botMemberForRole.permissions.has(PermissionFlagsBits.ManageRoles) || botMemberForRole.roles.highest.comparePositionTo(tryoutRole) <= 0) {
      throw new Error('I need Manage Roles and my bot role must be above the configured tryout role.');
    }
  }
  config.tickets.tryoutRoleId = tryoutRole?.id || null;
  config.tickets.logChannelId = interaction.options.getChannel('log-channel')?.id || null;
  config.tickets.notificationChannelId = interaction.options.getChannel('notification-channel')?.id || config.tickets.logChannelId || null;
  await saveConfigurations();
  return replyPrivately(interaction, `Tickets are configured. New tickets will be created in ${category} and visible to ${staffRole}.`);
}

async function handleCustomizeTickets(interaction, panelName) {
  requireAdminServer(interaction);
  const tickets = ensureConfiguration(interaction.guildId).tickets;
  const fieldNames = panelName === 'rivalsPanel'
    ? { title: 'title', description: 'description', color: 'color', footer: 'footer', buttonLabel: 'button-label' }
    : { title: 'title', description: 'description', color: 'color', footer: 'footer', supportLabel: 'support-label', reportLabel: 'report-label', otherLabel: 'other-label' };
  const fields = Object.fromEntries(Object.entries(fieldNames).map(([key, option]) => [key, interaction.options.getString(option)]));
  if (!Object.values(fields).some(Boolean)) throw new Error('Choose at least one setting to customize.');
  if (fields.color) parseColor(fields.color, 0);
  Object.assign(tickets[panelName], Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)));
  await saveConfigurations();
  return replyPrivately(interaction, `${panelName === 'rivalsPanel' ? 'CU tryout signup' : 'Ticket'} panel customization saved.`);
}

async function handleTicketPanel(interaction, rivals = false) {
  requireAdminServer(interaction);
  const tickets = ticketConfiguration(interaction.guildId);
  await validateTicketSetup(interaction.guild, tickets);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await canPost(interaction.guild, channel);
  await channel.send(rivals ? rivalsSignupPanel(tickets.rivalsPanel) : ticketPanel(tickets.panel));
  return replyPrivately(interaction, `${rivals ? 'CU tryout signup' : 'Ticket'} panel posted in ${channel}.`);
}

async function handleTicketButton(interaction) {
  const typeKey = interaction.customId.slice(TICKET_BUTTON_PREFIX.length);
  const names = { support: 'Support Ticket', report: 'Report Ticket', other: 'General Ticket' };
  if (!names[typeKey]) return;
  return createTicket(interaction, { type: names[typeKey] });
}

function rivalsSignupModal() {
  return new ModalBuilder()
    .setCustomId(RIVALS_SIGNUP_MODAL_ID)
    .setTitle('CU Tryout Application')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Roblox username (not display name)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('device').setLabel('Device: Mobile, Console, or PC').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rank').setLabel('What is your current rank?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('experience').setLabel('Experience and why you want to join').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('availability').setLabel('Usual availability (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)),
    );
}

async function handleRivalsSignup(interaction) {
  if (!ticketConfiguration(interaction.guildId)?.categoryId) return replyPrivately(interaction, 'CU tryout applications are not configured yet.', 'error');
  return interaction.showModal(rivalsSignupModal());
}

async function handleRivalsModal(interaction) {
  const device = interaction.fields.getTextInputValue('device').trim();
  if (!/^(mobile|console|pc)$/i.test(device)) throw new Error('Device must be exactly Mobile, Console, or PC.');
  const details = [
    { name: 'Roblox username', value: interaction.fields.getTextInputValue('username') },
    { name: 'Device', value: device },
    { name: 'Rank', value: interaction.fields.getTextInputValue('rank') },
    { name: 'Experience', value: interaction.fields.getTextInputValue('experience') },
    { name: 'Availability', value: interaction.fields.getTextInputValue('availability') || 'Not provided' },
  ];
  return createTicket(interaction, { type: CU_TRYOUT_TICKET_TYPE, details });
}

async function handleTicketClose(interaction) {
  if (!interaction.guild || !interaction.guildId || !interaction.channel) throw new Error('This can only be used inside a ticket channel.');
  const tickets = ticketConfiguration(interaction.guildId);
  const entry = Object.values(tickets?.open || {}).find((ticket) => ticket.channelId === interaction.channel.id && !ticket.closed);
  if (!entry) throw new Error('This is not an open ticket channel.');
  const isOwner = entry.ownerId === interaction.user.id;
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isOwner && !isStaff) throw new Error('Only the ticket owner or a server manager can close this ticket.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  entry.closed = true;
  entry.closedAt = Date.now();
  await saveConfigurations();
  await ticketLog(interaction.guild, tickets, 'Ticket Closed', `${interaction.user} closed ${interaction.channel}.`);
  await sendTicketNotification(interaction.guild, tickets, new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Ticket Closed — Member Available')
    .setDescription(`${entry.ownerMention} is now available. Create a ticket to join CU.`)
    .addFields({ name: 'Ticket', value: entry.type, inline: true }, { name: 'Closed by', value: `${interaction.user}`, inline: true })
    .setTimestamp());
  await editPrivateReply(interaction, 'Ticket closed. The channel will now be deleted.');
  await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
}

function ticketForChannel(interaction) {
  const tickets = ticketConfiguration(interaction.guildId);
  const ticket = Object.values(tickets?.open || {}).find((item) => item.channelId === interaction.channel?.id);
  if (!ticket) throw new Error('This is not a configured ticket channel.');
  return { tickets, ticket };
}

function requireTicketStaff(interaction) {
  if (!interaction.guild || !interaction.guildId) throw new Error('This control panel only works in a server ticket.');
  const { tickets, ticket } = ticketForChannel(interaction);
  const isManager = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  const isStaff = interaction.member?.roles?.cache?.has(tickets.staffRoleId);
  if (!isManager && !isStaff) throw new Error('Only ticket staff can use this control panel.');
  return { tickets, ticket };
}

async function sendTicketNotification(guild, tickets, embed) {
  const channelId = tickets.notificationChannelId || tickets.logChannelId;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => undefined);
}

async function handleTicketClaim(interaction) {
  const { tickets, ticket } = requireTicketStaff(interaction);
  if (ticket.claimedBy) return replyPrivately(interaction, `This ticket is already claimed by <@${ticket.claimedBy}>.`, 'info');
  ticket.claimedBy = interaction.user.id;
  ticket.claimedAt = Date.now();
  await saveConfigurations();
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Ticket Claimed')
    .setDescription(`<@${interaction.user.id}> is trying out ${ticket.ownerMention}.`)
    .addFields({ name: 'Ticket member', value: ticket.ownerMention, inline: true }, { name: 'Staff member', value: `${interaction.user}`, inline: true })
    .setTimestamp();
  await interaction.channel.send({ embeds: [embed] });
  await sendTicketNotification(interaction.guild, tickets, embed);
  return replyPrivately(interaction, 'You claimed this ticket.', 'success');
}

async function handleTryoutDecision(interaction, accepted) {
  const { tickets, ticket } = requireTicketStaff(interaction);
  if (ticket.type !== CU_TRYOUT_TICKET_TYPE && ticket.type !== 'Rivals Clan Application') throw new Error('Accept and deny are only available in tryout tickets.');
  ticket.tryoutStatus = accepted ? 'accepted' : 'denied';
  ticket.decidedBy = interaction.user.id;
  ticket.decidedAt = Date.now();
  await saveConfigurations();
  let awardedRole = null;
  if (accepted && tickets.tryoutRoleId) {
    const [member, role] = await Promise.all([
      interaction.guild.members.fetch(ticket.ownerId),
      interaction.guild.roles.fetch(tickets.tryoutRoleId),
    ]);
    if (!role || role.managed || role.position >= (await interaction.guild.members.fetchMe()).roles.highest.position) {
      throw new Error('The configured tryout role is missing or below my bot role. Update /setup-tickets.');
    }
    await member.roles.add(role, `Tryout accepted by ${interaction.user.tag}`);
    awardedRole = role;
  }
  const embed = new EmbedBuilder()
    .setColor(accepted ? 0x57f287 : 0xed4245)
    .setTitle(accepted ? 'Tryout Accepted' : 'Tryout Denied')
    .setDescription(accepted ? `${ticket.ownerMention} has been accepted${awardedRole ? ` and received the ${awardedRole} role` : ''}.` : `${ticket.ownerMention} has been denied.`)
    .addFields({ name: 'Decision by', value: `${interaction.user}`, inline: true })
    .setTimestamp();
  await interaction.channel.send({ embeds: [embed] });
  await ticketLog(interaction.guild, tickets, accepted ? 'Tryout Accepted' : 'Tryout Denied', `${ticket.ownerMention} was ${accepted ? 'accepted' : 'denied'} by ${interaction.user}.`);
  await sendTicketNotification(interaction.guild, tickets, embed);
  return replyPrivately(interaction, `The user has been ${accepted ? 'accepted' : 'denied'}.`, accepted ? 'success' : 'info');
}

function ticketWhitelistModal() {
  return new ModalBuilder()
    .setCustomId(TICKET_WHITELIST_MODAL_ID)
    .setTitle('Whitelist Ticket Owner')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Reason for whitelisting').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
    ));
}

function ticketGenerateKeysModal() {
  return new ModalBuilder()
    .setCustomId(TICKET_GENERATE_KEYS_MODAL_ID)
    .setTitle('Generate Whitelist Keys')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('How many keys? (1-50)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Why are these keys being generated?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
    );
}

function ticketRenameModal() {
  return new ModalBuilder()
    .setCustomId(TICKET_RENAME_MODAL_ID)
    .setTitle('Rename Ticket')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('New ticket name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(70),
    ));
}

async function handleTicketControlButton(interaction) {
  requireTicketStaff(interaction);
  if (interaction.customId === TICKET_CLAIM_BUTTON_ID) return handleTicketClaim(interaction);
  if (interaction.customId === TICKET_TRYOUT_ACCEPT_BUTTON_ID) return handleTryoutDecision(interaction, true);
  if (interaction.customId === TICKET_TRYOUT_DENY_BUTTON_ID) return handleTryoutDecision(interaction, false);
  if (interaction.customId === TICKET_WHITELIST_BUTTON_ID) {
    await validateWhitelistSetup(interaction.guild);
    return interaction.showModal(ticketWhitelistModal());
  }
  if (interaction.customId === TICKET_GENERATE_KEYS_BUTTON_ID) {
    await validateWhitelistSetup(interaction.guild);
    return interaction.showModal(ticketGenerateKeysModal());
  }
  if (interaction.customId === TICKET_RENAME_BUTTON_ID) return interaction.showModal(ticketRenameModal());
  return undefined;
}

async function handleTicketWhitelistModal(interaction) {
  const { tickets, ticket } = requireTicketStaff(interaction);
  const { role } = await validateWhitelistSetup(interaction.guild);
  const reason = interaction.fields.getTextInputValue('reason').trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(ticket.ownerId);
  if (member.roles.cache.has(role.id)) return editPrivateReply(interaction, `${member} already has the ${role.name} role.`, 'info');
  await member.roles.add(role, `Ticket whitelist: ${reason}`);
  ticket.closed = true;
  ticket.closedAt = Date.now();
  await saveConfigurations();
  await ticketLog(interaction.guild, tickets, 'Ticket Whitelist Action', `${interaction.user} whitelisted ${member}. Reason: ${reason}`);
  await editPrivateReply(interaction, `${member} was given the ${role.name} role. This ticket channel will now be deleted.`);
  await interaction.channel.delete(`Ticket owner whitelisted by ${interaction.user.tag}`);
}

async function handleTicketGenerateKeysModal(interaction) {
  const { tickets } = requireTicketStaff(interaction);
  const { whitelist } = await validateWhitelistSetup(interaction.guild);
  const amount = Number(interaction.fields.getTextInputValue('amount').trim());
  const reason = interaction.fields.getTextInputValue('reason').trim();
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) throw new Error('Amount must be a whole number from 1 to 50.');
  const keys = [];
  for (let index = 0; index < amount; index += 1) {
    let key = newWhitelistKey();
    while (whitelist.keys[key]) key = newWhitelistKey();
    whitelist.keys[key] = { createdAt: Date.now(), usedBy: null, usedAt: null, reason };
    keys.push(key);
  }
  await saveConfigurations();
  await interaction.reply({ embeds: [responseEmbed(`Generated **${keys.length}** whitelist keys for this ticket.\n\n${keys.map((key) => `\`${key}\``).join('\n')}\n\n**Reason:** ${reason}`, 'success')], flags: MessageFlags.Ephemeral });
  await ticketLog(interaction.guild, tickets, 'Whitelist Keys Generated', `${interaction.user} generated ${keys.length} key(s) from a ticket. Reason: ${reason}`);
}

async function handleTicketRenameModal(interaction) {
  requireTicketStaff(interaction);
  const name = safeChannelName(interaction.fields.getTextInputValue('name'));
  await interaction.channel.setName(name);
  return replyPrivately(interaction, `Ticket renamed to ${interaction.channel}.`);
}

function chooseWinners(entries, count, excluded = []) {
  const pool = entries.filter((id) => !excluded.includes(id));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count);
}

async function finishGiveaway(guildId, messageId) {
  const config = configuration(guildId);
  const giveaway = config?.giveaways?.find((item) => item.messageId === messageId);
  if (!giveaway || giveaway.ended) return;
  giveaway.ended = true;
  giveaway.winnerIds = chooseWinners(giveaway.entries, giveaway.winnerCount);
  await saveConfigurations();
  timers.delete(`${guildId}:${messageId}`);
  const guild = client.guilds.cache.get(guildId);
  const channel = guild && await guild.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (message) await message.edit({ embeds: [giveawayEmbed(giveaway, true)], components: giveawayComponents(giveaway, true) });
  const winners = giveaway.winnerIds.length ? giveaway.winnerIds.map((id) => `<@${id}>`).join(', ') : 'No valid entries';
  await channel.send({
    embeds: [responseEmbed(`🎉 **${giveaway.prize}** has ended!\n\nWinner${giveaway.winnerIds.length === 1 ? '' : 's'}: ${winners}`, 'success')],
  });
  await deliverGiveawayRewards(guildId, giveaway);
}

async function deliverGiveawayRewards(guildId, giveaway) {
  if (!giveaway.winnerIds?.length) return;
  giveaway.keys ||= [];
  giveaway.delivery ||= {};
  const alreadyAssigned = new Set(Object.values(giveaway.delivery).map((result) => result.keyIndex).filter(Number.isInteger));
  let delivered = 0;
  let failed = 0;
  let rolesAssigned = 0;
  const guild = client.guilds.cache.get(guildId);
  const winnerRole = guild && giveaway.winnerRoleId ? await guild.roles.fetch(giveaway.winnerRoleId).catch(() => null) : null;
  let rewardFileData = null;
  try {
    if (giveaway.rewardFile?.url) {
      const fileResponse = await fetch(giveaway.rewardFile.url);
      if (fileResponse.ok) rewardFileData = { buffer: Buffer.from(await fileResponse.arrayBuffer()), name: giveaway.rewardFile.name };
    } else if (giveaway.rewardText) {
      rewardFileData = { buffer: Buffer.from(giveaway.rewardText, 'utf8'), name: `reward.${giveaway.rewardExtension || 'txt'}` };
    }
  } catch (error) {
    console.error('Could not prepare the giveaway reward file:', error.message);
  }

  for (const winnerId of giveaway.winnerIds) {
    const priorDelivery = giveaway.delivery[winnerId];
    if (priorDelivery?.status === 'failed' || (priorDelivery?.status === 'delivered' && priorDelivery.keyIndex !== null)) continue;
    const keyIndex = giveaway.keys.findIndex((_, index) => !alreadyAssigned.has(index));
    if (keyIndex >= 0) alreadyAssigned.add(keyIndex);
    const key = keyIndex >= 0 ? giveaway.keys[keyIndex] : null;
    try {
      const user = await client.users.fetch(winnerId);
      if (winnerRole && guild) {
        const member = await guild.members.fetch(winnerId);
        await member.roles.add(winnerRole, 'Giveaway winner role');
        rolesAssigned += 1;
      }
      const rewardEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🎉 You won a giveaway!')
        .setDescription(`You won **${giveaway.prize}**.`)
        .addFields(
          key ? { name: 'Your reward key', value: `\`${key}\`` } : { name: 'Reward delivery', value: 'A staff member will contact you with your reward.' },
          ...(winnerRole ? [{ name: 'Winner role', value: `${winnerRole}` }] : []),
          ...(rewardFileData ? [{ name: 'Attached reward file', value: rewardFileData.name }] : []),
        )
        .setFooter({ text: 'Keep any reward key private.' })
        .setTimestamp();
      await user.send({ embeds: [rewardEmbed], files: rewardFileData ? [new AttachmentBuilder(rewardFileData.buffer, { name: rewardFileData.name })] : [] });
      giveaway.delivery[winnerId] = { status: key ? 'delivered' : 'pending-key', keyIndex: keyIndex >= 0 ? keyIndex : null, deliveredAt: Date.now() };
      delivered += 1;
    } catch (error) {
      giveaway.delivery[winnerId] = { status: 'failed', keyIndex: keyIndex >= 0 ? keyIndex : null, failedAt: Date.now() };
      failed += 1;
      console.error(`Could not DM giveaway winner ${winnerId}:`, error.message);
    }
  }
  await saveConfigurations();
  const channel = guild && await guild.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({
      embeds: [responseEmbed(`🎁 **Reward delivery completed** for **${giveaway.prize}**.\n\nDelivered by DM: **${delivered}**\nWinner roles assigned: **${rolesAssigned}**\nCould not DM/assign: **${failed}**\nKeys are never shown in this channel.`, failed ? 'info' : 'success')],
    });
  }
}

function scheduleGiveaway(guildId, giveaway) {
  if (giveaway.ended) return;
  const key = `${guildId}:${giveaway.messageId}`;
  clearTimeout(timers.get(key));
  const delay = Math.max(0, giveaway.endsAt - Date.now());
  timers.set(key, setTimeout(() => finishGiveaway(guildId, giveaway.messageId).catch((error) => console.error('Could not end giveaway:', error)), delay));
}

async function handleGiveawayStart(interaction) {
  requireAdminServer(interaction);
  const duration = parseDuration(interaction.options.getString('duration', true));
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await canPost(interaction.guild, channel);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const color = interaction.options.getString('color');
  if (color) parseColor(color, 0);
  const rewardFile = interaction.options.getAttachment('reward-file');
  const rewardText = interaction.options.getString('reward-text');
  if (rewardFile && rewardText) throw new Error('Choose either reward-file or reward-text, not both.');
  const extension = rewardExtension(interaction.options.getString('reward-file-type'));
  const winnerRole = interaction.options.getRole('winner-role');
  if (winnerRole) await validateRole(interaction.guild, winnerRole.id);
  const requiredRole = interaction.options.getRole('required-role');
  const blacklistRole = interaction.options.getRole('blacklist-role');
  if (requiredRole) await validateRole(interaction.guild, requiredRole.id);
  if (blacklistRole) await validateRole(interaction.guild, blacklistRole.id);
  const giveaway = {
    messageId: null,
    channelId: channel.id,
    prize: interaction.options.getString('prize', true),
    description: interaction.options.getString('description') || null,
    title: interaction.options.getString('title') || null,
    color,
    winnerCount: interaction.options.getInteger('winners', true),
    entries: [],
    blacklistIds: [],
    winnerIds: [],
    keys: [],
    delivery: {},
    rewardFile: rewardFile ? { url: rewardFile.url, name: `${(rewardFile.name || 'reward').replace(/\.[^.]+$/, '')}.${extension}` } : null,
    rewardText: rewardText || null,
    rewardExtension: extension,
    winnerRoleId: winnerRole?.id || null,
    minAccountAgeDays: interaction.options.getInteger('min-account-age') || 0,
    minMessages: interaction.options.getInteger('min-messages') || 0,
    minServerDays: interaction.options.getInteger('min-server-days') || 0,
    requireAvatar: interaction.options.getBoolean('require-avatar') || false,
    requireNickname: interaction.options.getBoolean('require-nickname') || false,
    requiredRoleId: requiredRole?.id || null,
    blacklistRoleId: blacklistRole?.id || null,
    endsAt: Date.now() + duration,
    ended: false,
  };
  const inlineKeys = interaction.options.getString('keys');
  if (inlineKeys) appendGiveawayKeys(giveaway, inlineKeys);
  const keyFile = interaction.options.getAttachment('key-file');
  if (keyFile) {
    const fileResponse = await fetch(keyFile.url);
    if (!fileResponse.ok) throw new Error('I could not download that key file.');
    appendGiveawayKeys(giveaway, await fileResponse.text());
  }
  const message = await channel.send({ embeds: [giveawayEmbed(giveaway)], components: giveawayComponents({ ...giveaway, messageId: 'pending' }) });
  giveaway.messageId = message.id;
  await message.edit({ embeds: [giveawayEmbed(giveaway)], components: giveawayComponents(giveaway) });
  ensureConfiguration(interaction.guildId).giveaways.push(giveaway);
  await saveConfigurations();
  scheduleGiveaway(interaction.guildId, giveaway);
  return editPrivateReply(interaction, `Giveaway started in ${channel}. Its message ID is \`${message.id}\`.`);
}

async function handleGiveawayEdit(interaction) {
  requireAdministrator(interaction);
  const giveaway = getGiveawayForCommand(interaction);
  if (giveaway.ended) throw new Error('That giveaway has already ended and cannot be edited.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = interaction.guild;
  const oldChannel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
  if (!oldChannel?.isTextBased()) throw new Error('The giveaway channel no longer exists.');
  const newChannel = interaction.options.getChannel('channel') || oldChannel;
  requireTextChannel(newChannel);
  await canPost(guild, newChannel);
  const botMember = await guild.members.fetchMe();
  if (!newChannel.permissionsFor(botMember)?.has(PermissionFlagsBits.AttachFiles)) throw new Error(`I need Attach Files in ${newChannel}.`);

  const updates = ['prize', 'description', 'title', 'color'].map((name) => [name, interaction.options.getString(name)]).filter(([, value]) => value !== null);
  for (const [name, value] of updates) {
    if (name === 'color') parseColor(value, 0);
    giveaway[name] = value;
  }
  const duration = interaction.options.getString('duration');
  if (duration) giveaway.endsAt = Date.now() + parseDuration(duration);
  const winners = interaction.options.getInteger('winners');
  if (winners) giveaway.winnerCount = winners;
  const winnerRole = interaction.options.getRole('winner-role');
  if (winnerRole) {
    await validateRole(guild, winnerRole.id);
    giveaway.winnerRoleId = winnerRole.id;
  }
  const minAccountAge = interaction.options.getInteger('min-account-age');
  if (minAccountAge !== null) giveaway.minAccountAgeDays = minAccountAge;
  const minMessages = interaction.options.getInteger('min-messages');
  if (minMessages !== null) giveaway.minMessages = minMessages;
  const minServerDays = interaction.options.getInteger('min-server-days');
  if (minServerDays !== null) giveaway.minServerDays = minServerDays;
  const requireAvatar = interaction.options.getBoolean('require-avatar');
  if (requireAvatar !== null) giveaway.requireAvatar = requireAvatar;
  const requireNickname = interaction.options.getBoolean('require-nickname');
  if (requireNickname !== null) giveaway.requireNickname = requireNickname;
  const requiredRole = interaction.options.getRole('required-role');
  if (requiredRole) {
    await validateRole(guild, requiredRole.id);
    giveaway.requiredRoleId = requiredRole.id;
  }
  const blacklistRole = interaction.options.getRole('blacklist-role');
  if (blacklistRole) {
    await validateRole(guild, blacklistRole.id);
    giveaway.blacklistRoleId = blacklistRole.id;
  }
  const inlineKeys = interaction.options.getString('keys');
  if (inlineKeys) appendGiveawayKeys(giveaway, inlineKeys);
  const keyFile = interaction.options.getAttachment('key-file');
  if (keyFile) {
    const keyResponse = await fetch(keyFile.url);
    if (!keyResponse.ok) throw new Error('I could not download that key file.');
    appendGiveawayKeys(giveaway, await keyResponse.text());
  }
  const rewardFile = interaction.options.getAttachment('reward-file');
  const rewardText = interaction.options.getString('reward-text');
  if (rewardFile && rewardText) throw new Error('Choose either reward-file or reward-text, not both.');
  const requestedExtension = interaction.options.getString('reward-file-type');
  if (rewardFile || rewardText || requestedExtension) {
    const extension = rewardExtension(requestedExtension || giveaway.rewardExtension);
    giveaway.rewardExtension = extension;
    if (rewardFile) giveaway.rewardFile = { url: rewardFile.url, name: `${(rewardFile.name || 'reward').replace(/\.[^.]+$/, '')}.${extension}` };
    if (rewardText) { giveaway.rewardText = rewardText; giveaway.rewardFile = null; }
  }

  const oldMessage = await oldChannel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!oldMessage) throw new Error('The giveaway message no longer exists.');
  if (newChannel.id !== oldChannel.id) {
    const pending = { ...giveaway, messageId: 'pending' };
    const newMessage = await newChannel.send({ embeds: [giveawayEmbed(pending)], components: giveawayComponents(pending) });
    giveaway.channelId = newChannel.id;
    giveaway.messageId = newMessage.id;
    await newMessage.edit({ embeds: [giveawayEmbed(giveaway)], components: giveawayComponents(giveaway) });
    await oldMessage.delete().catch(() => undefined);
  } else {
    await oldMessage.edit({ embeds: [giveawayEmbed(giveaway)], components: giveawayComponents(giveaway) });
  }
  await saveConfigurations();
  scheduleGiveaway(interaction.guildId, giveaway);
  return editPrivateReply(interaction, `Giveaway updated in ${newChannel}.`);
}

function getGiveawayForCommand(interaction) {
  const giveaway = configuration(interaction.guildId)?.giveaways?.find((item) => item.messageId === interaction.options.getString('message-id', true));
  if (!giveaway) throw new Error('No giveaway was found with that message ID.');
  return giveaway;
}

async function refreshGiveawayMessage(guild, giveaway) {
  const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [giveawayEmbed(giveaway, giveaway.ended)], components: giveawayComponents(giveaway, giveaway.ended) });
}

async function handleGiveawayAdminEntry(interaction, action) {
  requireAdministrator(interaction);
  const giveaway = getGiveawayForCommand(interaction);
  const user = interaction.options.getUser('user', true);
  giveaway.entries ||= [];
  giveaway.blacklistIds ||= [];
  if (action === 'add') {
    if (!giveaway.entries.includes(user.id)) giveaway.entries.push(user.id);
  } else {
    giveaway.entries = giveaway.entries.filter((id) => id !== user.id);
  }
  await saveConfigurations();
  await refreshGiveawayMessage(interaction.guild, giveaway);
  return replyPrivately(interaction, `${user} was ${action === 'add' ? 'added to' : 'removed from'} the giveaway.`, 'success');
}

async function handleGiveawayBlacklist(interaction) {
  requireAdministrator(interaction);
  const giveaway = getGiveawayForCommand(interaction);
  const user = interaction.options.getUser('user', true);
  const action = interaction.options.getString('action', true);
  giveaway.blacklistIds ||= [];
  if (action === 'add') {
    if (!giveaway.blacklistIds.includes(user.id)) giveaway.blacklistIds.push(user.id);
    giveaway.entries = (giveaway.entries || []).filter((id) => id !== user.id);
  } else {
    giveaway.blacklistIds = giveaway.blacklistIds.filter((id) => id !== user.id);
  }
  await saveConfigurations();
  await refreshGiveawayMessage(interaction.guild, giveaway);
  return replyPrivately(interaction, `${user} was ${action === 'add' ? 'blacklisted from' : 'removed from the blacklist of'} this giveaway.`, 'success');
}

function pollEmbed(poll, ended = false) {
  const total = poll.votes.reduce((sum, votes) => sum + votes.length, 0);
  const lines = poll.options.map((option, index) => `**${index + 1}. ${option}** — ${poll.votes[index].length} vote${poll.votes[index].length === 1 ? '' : 's'}`).join('\n');
  return new EmbedBuilder().setColor(parseColor(poll.color, ended ? 0x747f8d : 0x5865f2)).setTitle(poll.title || '📊 Poll').setDescription(`**${poll.question}**\n\n${lines}`).addFields({ name: 'Total votes', value: String(total), inline: true }, { name: ended ? 'Status' : 'Ends', value: ended ? 'Poll closed.' : formatEndTime(poll.endsAt), inline: true }).setFooter({ text: 'Vote buttons below • one vote per member' }).setTimestamp();
}

function pollComponents(poll, disabled = false) {
  return [new ActionRowBuilder().addComponents(poll.options.map((option, index) => new ButtonBuilder().setCustomId(`${POLL_VOTE_PREFIX}${poll.messageId}:${index}`).setLabel(option.slice(0, 80)).setStyle(ButtonStyle.Primary).setDisabled(disabled)))];
}

async function finishPoll(guildId, messageId) {
  const poll = configuration(guildId)?.polls?.find((item) => item.messageId === messageId);
  if (!poll || poll.ended) return;
  poll.ended = true;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  const channel = guild && await guild.channels.fetch(poll.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [pollEmbed(poll, true)], components: pollComponents(poll, true) });
  await saveConfigurations();
}

async function handlePollStart(interaction) {
  requireAdminServer(interaction);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await canPost(interaction.guild, channel);
  const options = interaction.options.getString('options', true).split(',').map((value) => value.trim()).filter(Boolean);
  if (options.length < 2 || options.length > 5) throw new Error('Polls require between 2 and 5 comma-separated options.');
  const duration = parseDuration(interaction.options.getString('duration', true));
  const color = interaction.options.getString('color');
  if (color) parseColor(color, 0);
  const poll = { messageId: null, channelId: channel.id, question: interaction.options.getString('question', true), options, title: interaction.options.getString('title'), color, votes: options.map(() => []), endsAt: Date.now() + duration, ended: false };
  const message = await channel.send({ embeds: [pollEmbed(poll)], components: pollComponents({ ...poll, messageId: 'pending' }) });
  poll.messageId = message.id;
  await message.edit({ embeds: [pollEmbed(poll)], components: pollComponents(poll) });
  ensureConfiguration(interaction.guildId).polls.push(poll);
  await saveConfigurations();
  timers.set(`poll:${interaction.guildId}:${poll.messageId}`, setTimeout(() => finishPoll(interaction.guildId, poll.messageId).catch(console.error), duration));
  return replyPrivately(interaction, `Poll started in ${channel}. Message ID: \`${message.id}\`.`);
}

function getPollForCommand(interaction) {
  const messageId = interaction.options.getString('message-id', true);
  const poll = configuration(interaction.guildId)?.polls?.find((item) => item.messageId === messageId);
  if (!poll) throw new Error('No poll was found with that message ID.');
  return poll;
}

async function handlePollEdit(interaction) {
  requireAdminServer(interaction);
  const poll = getPollForCommand(interaction);
  if (poll.ended) throw new Error('That poll has already ended.');
  const question = interaction.options.getString('question');
  const rawOptions = interaction.options.getString('options');
  const duration = interaction.options.getString('duration');
  const title = interaction.options.getString('title');
  const color = interaction.options.getString('color');
  const newChannel = interaction.options.getChannel('channel');
  if (question !== null) poll.question = question;
  if (title !== null) poll.title = title;
  if (color !== null) { parseColor(color, 0); poll.color = color; }
  if (rawOptions !== null) {
    const options = rawOptions.split(',').map((value) => value.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 5) throw new Error('Polls require between 2 and 5 comma-separated options.');
    poll.options = options;
    poll.votes = options.map(() => []);
  }
  if (duration !== null) poll.endsAt = Date.now() + parseDuration(duration);
  const oldChannel = await interaction.guild.channels.fetch(poll.channelId).catch(() => null);
  const targetChannel = newChannel || oldChannel;
  requireTextChannel(targetChannel);
  await canPost(interaction.guild, targetChannel);
  const oldMessage = oldChannel?.isTextBased() ? await oldChannel.messages.fetch(poll.messageId).catch(() => null) : null;
  if (!oldMessage) throw new Error('The poll message could not be found.');
  if (targetChannel.id !== poll.channelId) {
    const newMessage = await targetChannel.send({ embeds: [pollEmbed(poll)], components: pollComponents({ ...poll, messageId: 'pending' }) });
    poll.channelId = targetChannel.id;
    poll.messageId = newMessage.id;
    await newMessage.edit({ embeds: [pollEmbed(poll)], components: pollComponents(poll) });
    await oldMessage.delete().catch(() => undefined);
  } else {
    await oldMessage.edit({ embeds: [pollEmbed(poll)], components: pollComponents(poll) });
  }
  await saveConfigurations();
  const pollTimerKey = `poll:${interaction.guildId}:${poll.messageId}`;
  if (timers.has(pollTimerKey)) clearTimeout(timers.get(pollTimerKey));
  timers.set(pollTimerKey, setTimeout(() => finishPoll(interaction.guildId, poll.messageId).catch(console.error), Math.max(0, poll.endsAt - Date.now())));
  return replyPrivately(interaction, `Poll updated in ${targetChannel}.`, 'success');
}

async function handlePollEnd(interaction) {
  requireAdministrator(interaction);
  const poll = getPollForCommand(interaction);
  if (poll.ended) throw new Error('That poll has already ended.');
  await finishPoll(interaction.guildId, poll.messageId);
  return replyPrivately(interaction, 'Poll ended and the final results are displayed.', 'success');
}

async function handlePollAdminCommand(interaction) {
  requireAdministrator(interaction);
  const poll = getPollForCommand(interaction);
  if (interaction.commandName === 'poll-voters') {
    const option = interaction.options.getInteger('option', true) - 1;
    if (!poll.options[option]) throw new Error('That poll option does not exist.');
    const voters = poll.votes[option] || [];
    return replyPrivately(interaction, `**${poll.options[option]}** voters (${voters.length})\n\n${voters.length ? voters.map((id) => `<@${id}>`).join('\n') : 'No voters for this option.'}`, 'info');
  }
  const user = interaction.options.getUser('user', true);
  for (const votes of poll.votes) {
    const index = votes.indexOf(user.id);
    if (index !== -1) votes.splice(index, 1);
  }
  await saveConfigurations();
  const channel = await interaction.guild.channels.fetch(poll.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(poll.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [pollEmbed(poll, poll.ended)], components: pollComponents(poll, poll.ended) });
  return replyPrivately(interaction, `Removed ${user}'s vote from the poll.`, 'success');
}

async function handlePollVote(interaction) {
  const raw = interaction.customId.slice(POLL_VOTE_PREFIX.length);
  const [messageId, indexText] = raw.split(':');
  const poll = configuration(interaction.guildId)?.polls?.find((item) => item.messageId === messageId);
  const index = Number(indexText);
  if (!poll || poll.ended || Date.now() >= poll.endsAt) return replyPrivately(interaction, 'This poll has ended.', 'error');
  if (!Number.isInteger(index) || !poll.options[index]) throw new Error('That poll option is invalid.');
  if (poll.votes.some((votes) => votes.includes(interaction.user.id))) return replyPrivately(interaction, 'You already voted in this poll.', 'info');
  poll.votes[index].push(interaction.user.id);
  await saveConfigurations();
  const channel = await interaction.guild.channels.fetch(poll.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(poll.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [pollEmbed(poll)], components: pollComponents(poll) });
  return replyPrivately(interaction, `Your vote for **${poll.options[index]}** was recorded.`, 'success');
}

function reactionEmojiKey(emoji) {
  return emoji.id || emoji.name;
}

function normalizeReactionEmoji(value) {
  const custom = /^<a?:[^:>]+:(\d+)>$/.exec(value);
  return custom ? custom[1] : value;
}

async function handleReactionRewardCommand(interaction) {
  requireAdminServer(interaction);
  const channel = interaction.options.getChannel('channel', true);
  const messageId = interaction.options.getString('message-id', true);
  const emojiInput = interaction.options.getString('emoji', true).trim();
  const rewardText = interaction.options.getString('reward-text');
  const rewardFile = interaction.options.getAttachment('reward-file');
  if (!rewardText && !rewardFile) throw new Error('Provide reward-text or reward-file.');
  if (rewardText && rewardFile) throw new Error('Choose reward-text or reward-file, not both.');
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) throw new Error('I could not find that message.');
  const extension = rewardExtension(interaction.options.getString('file-type'));
  await message.react(emojiInput);
  const reward = { guildId: interaction.guildId, channelId: channel.id, messageId, emoji: normalizeReactionEmoji(emojiInput), rewardText: rewardText || null, rewardFile: rewardFile ? { url: rewardFile.url, name: `${(rewardFile.name || 'reward').replace(/\.[^.]+$/, '')}.${extension}` } : null, delivered: [], createdBy: interaction.user.id, createdAt: Date.now() };
  const config = ensureConfiguration(interaction.guildId);
  config.reactionRewards = config.reactionRewards.filter((item) => !(item.channelId === channel.id && item.messageId === messageId && item.emoji === reward.emoji));
  config.reactionRewards.push(reward);
  await saveConfigurations();
  return replyPrivately(interaction, `Reaction reward configured on ${message}. React with ${emojiInput} to receive it by DM.`, 'success');
}

async function handleReactionRewardRemove(interaction) {
  requireAdminServer(interaction);
  const channel = interaction.options.getChannel('channel', true);
  const messageId = interaction.options.getString('message-id', true);
  const config = ensureConfiguration(interaction.guildId);
  const before = config.reactionRewards.length;
  config.reactionRewards = config.reactionRewards.filter((item) => !(item.channelId === channel.id && item.messageId === messageId));
  if (before === config.reactionRewards.length) throw new Error('No reaction reward was found on that message.');
  await saveConfigurations();
  return replyPrivately(interaction, 'Reaction rewards removed from that message.', 'success');
}

async function handleReactionRewardAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  const message = reaction.message;
  const guildId = message.guildId;
  if (!guildId) return;
  const config = configuration(guildId);
  const key = reactionEmojiKey(reaction.emoji);
  const reward = config?.reactionRewards?.find((item) => item.channelId === message.channelId && item.messageId === message.id && item.emoji === key);
  if (!reward || reward.delivered.includes(user.id)) return;
  const files = [];
  if (reward.rewardFile?.url) {
    const response = await fetch(reward.rewardFile.url).catch(() => null);
    if (response?.ok) files.push(new AttachmentBuilder(Buffer.from(await response.arrayBuffer()), { name: reward.rewardFile.name }));
  }
  const dm = { embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎁 Reaction Reward').setDescription(reward.rewardText || 'Your reward file is attached.').setFooter({ text: 'Thanks for participating!' }).setTimestamp()], files };
  try {
    await user.send(dm);
    reward.delivered.push(user.id);
    await saveConfigurations();
  } catch (error) {
    console.error(`Could not DM reaction reward to ${user.id}:`, error.message);
  }
}

function libraryPagePayload(guildId, page) {
  const library = ensureConfiguration(guildId).library;
  const size = 8;
  const pages = Math.max(1, Math.ceil(library.entries.length / size));
  const current = Math.min(Math.max(page, 1), pages);
  const entries = library.entries.slice((current - 1) * size, current * size);
  const panel = library.panel;
  const description = entries.length ? entries.map((entry, index) => `**${(current - 1) * size + index + 1}. ${entry.name}** — ${entry.description || 'No description'}\nTier: **${entry.tier || 'free'}**${entry.tier === 'buyer' ? ` • Price: **${economyLabel(guildId, entry.price || 0)}**` : ''}\nFiles: **${entry.files.length}**${entry.text ? ' • Text included' : ''}`).join('\n\n') : 'The library is empty.';
  const embed = new EmbedBuilder().setColor(parseColor(panel.color, 0x5865f2)).setTitle(panel.title || 'Configuration Library').setDescription(panel.description ? `${panel.description}\n\n${description}` : description).setFooter({ text: `${panel.footer || 'Use the get option to receive an entry by DM.'} • Page ${current}/${pages}` }).setTimestamp();
  const components = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${LIBRARY_PAGE_PREFIX}${guildId}:${current - 1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(current <= 1),
    new ButtonBuilder().setCustomId(`${LIBRARY_PAGE_PREFIX}${guildId}:${current + 1}`).setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(current >= pages),
  )];
  return { embeds: [embed], components };
}

function libraryPanelPayload(tier, options = {}) {
  const buyer = tier === 'buyer';
  return { embeds: [new EmbedBuilder().setColor(parseColor(options.color, buyer ? 0xf1c40f : 0x57f287)).setTitle(options.title || (buyer ? '💎 Buyer Config Library' : '🆓 Free Config Library')).setDescription(options.description || (buyer ? 'Purchase script configs with CU coins, then receive them by DM.' : 'Browse and receive free script configs by DM.')).setFooter({ text: 'Use the button below to browse entries.' }).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${LIBRARY_PANEL_PREFIX}${tier}`).setLabel(buyer ? 'Browse Buyer Configs' : 'Browse Free Configs').setEmoji(buyer ? '💎' : '📦').setStyle(buyer ? ButtonStyle.Success : ButtonStyle.Primary), new ButtonBuilder().setCustomId(`${LIBRARY_STAFF_PREFIX}${tier}`).setLabel('Staff Controls').setEmoji('🛠️').setStyle(ButtonStyle.Secondary))] };
}

async function sendLibraryEntryDM(interaction, entry) {
  const files = [];
  for (const file of entry.files || []) {
    const response = await fetch(file.url).catch(() => null);
    if (response?.ok) files.push(new AttachmentBuilder(Buffer.from(await response.arrayBuffer()), { name: file.name }));
  }
  if (entry.text) files.push(new AttachmentBuilder(Buffer.from(entry.text, 'utf8'), { name: `${entry.name}.${entry.fileType || 'txt'}` }));
  await interaction.user.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(`📦 ${entry.name}`).setDescription(entry.description || 'Your requested configuration is attached.').setTimestamp()], files });
}

async function handleLibraryCommand(interaction) {
  const library = ensureConfiguration(interaction.guildId).library;
  const requested = interaction.options.getString('get')?.trim();
  if (requested) {
    const entry = library.entries.find((item) => item.name.toLowerCase() === requested.toLowerCase());
    if (!entry) throw new Error('That library entry was not found.');
    if (entry.tier === 'buyer' && !BOT_OWNER_IDS.has(interaction.user.id)) {
      const price = Number(entry.price || 0);
      const balance = economyBalance(interaction.guildId, interaction.user.id);
      if (balance < price) throw new Error(`You need **${economyLabel(interaction.guildId, price)}** to purchase this config. Your balance: **${economyLabel(interaction.guildId, balance)}**.`);
      const economy = economyFor(interaction.guildId);
      economy.balances[interaction.user.id] = balance - price;
      await saveConfigurations();
    }
    await sendLibraryEntryDM(interaction, entry);
    return replyPrivately(interaction, `**${entry.name}** was sent to your DMs.`, 'success');
  }
  return interaction.reply({ ...libraryPagePayload(interaction.guildId, interaction.options.getInteger('page') || 1), flags: MessageFlags.Ephemeral });
}

async function handleLibraryPanelButton(interaction) {
  const tier = interaction.customId.slice(LIBRARY_PANEL_PREFIX.length);
  const entries = ensureConfiguration(interaction.guildId).library.entries.filter((entry) => (entry.tier || 'free') === tier);
  return interaction.reply({ embeds: [new EmbedBuilder().setColor(tier === 'buyer' ? 0xf1c40f : 0x57f287).setTitle(`${tier === 'buyer' ? 'Buyer' : 'Free'} Configs`).setDescription(entries.length ? entries.map((entry) => `**${entry.name}**${tier === 'buyer' ? ` — ${economyLabel(interaction.guildId, entry.price || 0)}` : ''}`).join('\n') : 'No entries available.')], flags: MessageFlags.Ephemeral });
}

async function handleLibraryStaffButton(interaction) {
  requireAdminServer(interaction);
  const tier = interaction.customId.slice(LIBRARY_STAFF_PREFIX.length);
  const entries = ensureConfiguration(interaction.guildId).library.entries.filter((entry) => (entry.tier || 'free') === tier);
  return replyPrivately(interaction, `Staff view — **${tier}** library entries:\n\n${entries.map((entry) => `• ${entry.name} (${entry.files.length} files)`).join('\n') || 'Empty.'}`, 'info');
}

async function handleLibraryAdminCommand(interaction) {
  requireAdminServer(interaction);
  const library = ensureConfiguration(interaction.guildId).library;
  if (interaction.commandName === 'library-panel') {
    const channel = requireTextChannel(interaction.options.getChannel('channel', true));
    await canPost(interaction.guild, channel);
    const tier = interaction.options.getString('tier', true);
    const color = interaction.options.getString('color');
    if (color) parseColor(color, 0);
    await channel.send(libraryPanelPayload(tier, { title: interaction.options.getString('title'), description: interaction.options.getString('description'), color }));
    return replyPrivately(interaction, `${tier === 'buyer' ? 'Buyer' : 'Free'} library panel posted in ${channel}.`, 'success');
  }
  if (interaction.commandName === 'config-library-add') {
    const name = interaction.options.getString('name', true).trim();
    const files = ['file1', 'file2', 'file3'].map((key) => interaction.options.getAttachment(key)).filter(Boolean).map((file) => ({ url: file.url, name: file.name }));
    const text = interaction.options.getString('text');
    if (!files.length && !text) throw new Error('Add at least one file or text content.');
    if (library.entries.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) throw new Error('A library entry with that name already exists.');
    const tier = interaction.options.getString('tier') || 'free';
    library.entries.push({ name, description: interaction.options.getString('description') || null, text: text || null, fileType: rewardExtension(interaction.options.getString('file-type')), files, tier, price: interaction.options.getInteger('price') || 0, createdAt: Date.now(), createdBy: interaction.user.id });
    await saveConfigurations();
    return replyPrivately(interaction, `Added **${name}** to the configuration library.`, 'success');
  }
  if (interaction.commandName === 'config-library-remove') {
    const name = interaction.options.getString('name', true).trim();
    const before = library.entries.length;
    library.entries = library.entries.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
    if (before === library.entries.length) throw new Error('That library entry was not found.');
    await saveConfigurations();
    return replyPrivately(interaction, `Removed **${name}** from the library.`, 'success');
  }
  const updates = { title: interaction.options.getString('title'), description: interaction.options.getString('description'), color: interaction.options.getString('color'), footer: interaction.options.getString('footer') };
  if (!Object.values(updates).some((value) => value !== null)) throw new Error('Choose at least one library setting.');
  if (updates.color) parseColor(updates.color, 0);
  Object.assign(library.panel, Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== null)));
  await saveConfigurations();
  return replyPrivately(interaction, 'Library embed settings saved.', 'success');
}

async function handleLibraryPageButton(interaction) {
  const [, guildId, pageText] = interaction.customId.split(':');
  if (interaction.guildId !== guildId) throw new Error('This library panel belongs to another server.');
  return interaction.update(libraryPagePayload(guildId, Number(pageText)));
}

async function handleGiveawayEnd(interaction) {
  requireAdministrator(interaction);
  const giveaway = getGiveawayForCommand(interaction);
  if (giveaway.ended) throw new Error('That giveaway has already ended. Use /giveaway-reroll instead.');
  await finishGiveaway(interaction.guildId, giveaway.messageId);
  return replyPrivately(interaction, 'Giveaway ended and winners were selected.');
}

async function handleGiveawayReroll(interaction) {
  requireAdministrator(interaction);
  const giveaway = getGiveawayForCommand(interaction);
  if (!giveaway.ended) throw new Error('End this giveaway before rerolling it.');
  const winnerIds = chooseWinners(giveaway.entries, giveaway.winnerCount, giveaway.winnerIds);
  if (!winnerIds.length) throw new Error('There are no additional eligible entrants to reroll.');
  giveaway.winnerIds = winnerIds;
  await saveConfigurations();
  const channel = await interaction.guild.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({
      embeds: [responseEmbed(`🔄 Reroll for **${giveaway.prize}**\n\nNew winner${winnerIds.length === 1 ? '' : 's'}: ${winnerIds.map((id) => `<@${id}>`).join(', ')}`, 'info')],
    });
  }
  await deliverGiveawayRewards(interaction.guildId, giveaway);
  return replyPrivately(interaction, 'Reroll complete.');
}

function appendGiveawayKeys(giveaway, rawKeys) {
  const keys = rawKeys.split(/\r?\n/).map((key) => key.trim()).filter(Boolean);
  if (!keys.length) throw new Error('Enter at least one reward key.');
  giveaway.keys ||= [];
  giveaway.keys.push(...keys);
  return keys.length;
}

async function logVerification(interaction, role, config) {
  if (!config.logChannelId) return;
  const channel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Member Verified').addFields({ name: 'Member', value: `${interaction.user} (${interaction.user.id})` }, { name: 'Role', value: `${role}` }).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()] }).catch(() => undefined);
}

async function handleVerify(interaction) {
  if (!interaction.guild || !interaction.guildId) return replyPrivately(interaction, 'Verification must be completed in a server.', 'error');
  const config = configuration(interaction.guildId);
  if (!config?.verifiedRoleId) return replyPrivately(interaction, 'This server has not configured verification yet.', 'error');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const role = await validateRole(interaction.guild, config.verifiedRoleId);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) return editPrivateReply(interaction, `You are already verified with the ${role.name} role.`, 'info');
  await member.roles.add(role, 'Member completed the verification panel');
  await logVerification(interaction, role, config);
  return editPrivateReply(interaction, `You are verified! You now have the ${role.name} role.`);
}

async function handleGiveawayEntry(interaction) {
  if (!interaction.guildId) return replyPrivately(interaction, 'Giveaways can only be entered in a server.', 'error');
  const messageId = interaction.customId.slice(GIVEAWAY_BUTTON_PREFIX.length);
  const giveaway = configuration(interaction.guildId)?.giveaways?.find((item) => item.messageId === messageId);
  if (!giveaway || giveaway.ended || Date.now() >= giveaway.endsAt) return replyPrivately(interaction, 'This giveaway has ended.', 'error');
  giveaway.blacklistIds ||= [];
  if (giveaway.blacklistIds.includes(interaction.user.id)) return replyPrivately(interaction, 'You are blacklisted from this giveaway.', 'error');
  if (giveaway.entries.includes(interaction.user.id)) return replyPrivately(interaction, 'You are already entered in this giveaway.', 'info');
  if (giveaway.minAccountAgeDays) {
    const ageDays = (Date.now() - interaction.user.createdTimestamp) / 86_400_000;
    if (ageDays < giveaway.minAccountAgeDays) return replyPrivately(interaction, `Your Discord account must be at least **${giveaway.minAccountAgeDays} days** old to enter.`, 'error');
  }
  const messageCount = Number(ensureConfiguration(interaction.guildId).messageCounts[interaction.user.id] || 0);
  if (giveaway.minMessages && messageCount < giveaway.minMessages) return replyPrivately(interaction, `You need at least **${giveaway.minMessages}** server messages to enter. Your count: **${messageCount}**.`, 'error');
  let member = null;
  if (giveaway.requiredRoleId || giveaway.blacklistRoleId || giveaway.minServerDays || giveaway.requireNickname) {
    member = await interaction.guild.members.fetch(interaction.user.id);
    if (giveaway.minServerDays) {
      const joinedDays = (Date.now() - (member.joinedTimestamp || Date.now())) / 86_400_000;
      if (joinedDays < giveaway.minServerDays) return replyPrivately(interaction, `You must be in this server for at least **${giveaway.minServerDays} days** to enter.`, 'error');
    }
    if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) return replyPrivately(interaction, `You need the <@&${giveaway.requiredRoleId}> role to enter.`, 'error');
    if (giveaway.blacklistRoleId && member.roles.cache.has(giveaway.blacklistRoleId)) return replyPrivately(interaction, 'You are not eligible for this giveaway.', 'error');
    if (giveaway.requireNickname && !member.nickname) return replyPrivately(interaction, 'You need a server nickname to enter.', 'error');
  }
  if (giveaway.requireAvatar && !interaction.user.avatar) return replyPrivately(interaction, 'You need a custom Discord avatar to enter.', 'error');
  giveaway.entries.push(interaction.user.id);
  await saveConfigurations();
  const channel = await interaction.guild.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [giveawayEmbed(giveaway)], components: giveawayComponents(giveaway) }).catch(() => undefined);
  return replyPrivately(interaction, `You are entered to win **${giveaway.prize}**!`);
}

function trackServerMessage(message) {
  if (!message.guildId || message.author?.bot) return;
  const config = ensureConfiguration(message.guildId);
  config.messageCounts[message.author.id] = Number(config.messageCounts[message.author.id] || 0) + 1;
  if (!messageSaveTimer) {
    messageSaveTimer = setTimeout(() => {
      messageSaveTimer = null;
      saveConfigurations().catch((error) => console.error('Could not save message counts:', error));
    }, 2000);
  }
}

async function handleGiveawayStaffButton(interaction) {
  const ending = interaction.customId.startsWith(GIVEAWAY_END_BUTTON_PREFIX);
  const participantsButton = interaction.customId.startsWith(GIVEAWAY_PARTICIPANTS_PREFIX);
  const prefix = ending ? GIVEAWAY_END_BUTTON_PREFIX : participantsButton ? GIVEAWAY_PARTICIPANTS_PREFIX : GIVEAWAY_REFRESH_BUTTON_PREFIX;
  const messageId = interaction.customId.slice(prefix.length);
  if (ending && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) throw new Error('Only Administrators can end giveaways.');
  if (!ending && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Only giveaway staff can use this button.');
  const giveaway = configuration(interaction.guildId)?.giveaways?.find((item) => item.messageId === messageId);
  if (!giveaway) throw new Error('This giveaway no longer exists.');
  if (participantsButton) {
    const entries = giveaway.entries || [];
    const mentions = entries.slice(0, 100).map((id, index) => `${index + 1}. <@${id}>`).join('\n') || 'No participants yet.';
    const suffix = entries.length > 100 ? `\n\nShowing the first 100 of **${entries.length}** participants.` : '';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`Participants — ${giveaway.prize}`).setDescription(`${mentions}${suffix}`).setFooter({ text: `Total participants: ${entries.length}` }).setTimestamp()], flags: MessageFlags.Ephemeral });
  }
  if (ending) {
    if (giveaway.ended) return replyPrivately(interaction, 'This giveaway has already ended.', 'info');
    await finishGiveaway(interaction.guildId, messageId);
    return replyPrivately(interaction, 'Giveaway ended and winners were selected.', 'success');
  }
  const channel = await interaction.guild.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel?.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (!message) throw new Error('The giveaway message could not be found.');
  await message.edit({ embeds: [giveawayEmbed(giveaway)], components: giveawayComponents(giveaway) });
  return replyPrivately(interaction, `Participant count refreshed: **${giveaway.entries.length}**.`, 'info');
}

async function registerGuildCommands(guildId) {
  await rest.put(Routes.applicationGuildCommands(app.clientId, guildId), { body: commands });
  console.log(`Registered commands for server ${guildId}.`);
}

client.once('clientReady', async (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}`);
  const registrationResults = await Promise.allSettled([...readyClient.guilds.cache.keys()].map(registerGuildCommands));
  for (const result of registrationResults) {
    if (result.status === 'rejected') console.error('Command registration failed:', result.reason?.message || result.reason);
  }
  await Promise.allSettled([...readyClient.guilds.cache.values()].map(cacheGuildInvites));
  for (const [guildId, config] of Object.entries(guildConfigurations)) {
    for (const giveaway of config.giveaways || []) scheduleGiveaway(guildId, giveaway);
    for (const poll of config.polls || []) {
      if (poll.ended) continue;
      timers.set(`poll:${guildId}:${poll.messageId}`, setTimeout(() => finishPoll(guildId, poll.messageId).catch((error) => console.error('Could not end poll:', error)), Math.max(0, poll.endsAt - Date.now())));
    }
  }
});
client.on('guildCreate', (guild) => {
  registerGuildCommands(guild.id).catch((error) => console.error('Command registration failed:', error));
  sendApprovalRequest({ id: randomBytes(5).toString('hex'), type: 'server', targetId: guild.id, reason: `Bot joined ${guild.name}; owner approval requested.`, requesterId: guild.ownerId, createdAt: Date.now() }).catch((error) => console.error('Could not send server approval request:', error));
});
client.on('inviteCreate', (invite) => cacheGuildInvites(invite.guild).catch(() => undefined));
client.on('inviteDelete', (invite) => cacheGuildInvites(invite.guild).catch(() => undefined));
client.on('guildMemberAdd', (member) => handleMemberJoin(member).catch((error) => console.error('Join tracking failed:', error)));
client.on('guildMemberRemove', (member) => sendMemberTracking(member, false, null).catch((error) => console.error('Leave tracking failed:', error)));
client.on('messageCreate', trackServerMessage);
client.on('messageReactionAdd', (reaction, user) => handleReactionRewardAdd(reaction, user).catch((error) => console.error('Reaction reward failed:', error)));

client.on('interactionCreate', async (interaction) => {
  try {
    const access = accessControlStore();
    if (!BOT_OWNER_IDS.has(interaction.user.id) && (GLOBAL_BOT_BLACKLIST.has(interaction.user.id) || access.userBlacklist[interaction.user.id] || (interaction.guildId && (access.serverBlacklist[interaction.guildId] || OWNER_ONLY_SERVER_IDS.has(interaction.guildId))))) return replyPrivately(interaction, 'You are blocked from using this bot in this server.', 'error');
    const serverBlacklist = interaction.guildId ? configuration(interaction.guildId)?.userBlacklist || {} : {};
    if (serverBlacklist[interaction.user.id] && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return replyPrivately(interaction, 'You are blacklisted from using this bot in this server.', 'error');
    }
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'help') await interaction.reply({ ...helpMessage(interaction.options.getString('category') || 'all'), flags: MessageFlags.Ephemeral });
      else if (interaction.commandName === 'setup-verification') await handleSetup(interaction);
      else if (interaction.commandName === 'customize-verification') await handleCustomize(interaction);
      else if (interaction.commandName === 'verification-panel') await handlePanel(interaction);
      else if (interaction.commandName === 'giveaway-start') await handleGiveawayStart(interaction);
      else if (interaction.commandName === 'giveaway-edit') await handleGiveawayEdit(interaction);
      else if (interaction.commandName === 'giveaway-entry-add') await handleGiveawayAdminEntry(interaction, 'add');
      else if (interaction.commandName === 'giveaway-entry-remove') await handleGiveawayAdminEntry(interaction, 'remove');
      else if (interaction.commandName === 'giveaway-blacklist') await handleGiveawayBlacklist(interaction);
      else if (interaction.commandName === 'poll-start') await handlePollStart(interaction);
      else if (interaction.commandName === 'poll-edit') await handlePollEdit(interaction);
      else if (interaction.commandName === 'poll-end') await handlePollEnd(interaction);
      else if (interaction.commandName === 'poll-voters' || interaction.commandName === 'poll-vote-remove') await handlePollAdminCommand(interaction);
      else if (['user-blacklist-add', 'user-blacklist-remove', 'user-blacklist-list'].includes(interaction.commandName)) await handleUserBlacklistCommand(interaction);
      else if (['server-copy', 'server-paste', 'server-config-copy', 'server-config-paste'].includes(interaction.commandName)) await handleServerTemplateCommand(interaction);
      else if (interaction.commandName === 'request') await handleAccessRequestCommand(interaction);
      else if (interaction.commandName === 'global-blacklist') await handleGlobalBlacklistCommand(interaction);
      else if (interaction.commandName === 'global-whitelist') await handleGlobalWhitelistCommand(interaction);
      else if (interaction.commandName === 'command-search') await handleCommandSearch(interaction);
      else if (interaction.commandName === 'reaction-reward') await handleReactionRewardCommand(interaction);
      else if (interaction.commandName === 'reaction-reward-remove') await handleReactionRewardRemove(interaction);
      else if (interaction.commandName === 'library' || interaction.commandName === 'config-library') await handleLibraryCommand(interaction);
      else if (['config-library-add', 'config-library-remove', 'config-library-settings', 'library-panel'].includes(interaction.commandName)) await handleLibraryAdminCommand(interaction);
      else if (interaction.commandName === 'giveaway-end') await handleGiveawayEnd(interaction);
      else if (interaction.commandName === 'giveaway-reroll') await handleGiveawayReroll(interaction);
      else if (interaction.commandName === 'setup-tickets') await handleSetupTickets(interaction);
      else if (interaction.commandName === 'customize-tickets') await handleCustomizeTickets(interaction, 'panel');
      else if (interaction.commandName === 'ticket-panel') await handleTicketPanel(interaction);
      else if (interaction.commandName === 'customize-rivals-signup') await handleCustomizeTickets(interaction, 'rivalsPanel');
      else if (interaction.commandName === 'rivals-signup-panel') await handleTicketPanel(interaction, true);
      else if (interaction.commandName === 'ticket-close') await handleTicketClose(interaction);
      else if (interaction.commandName === 'setup-whitelist') await handleSetupWhitelist(interaction);
      else if (interaction.commandName === 'customize-whitelist') await handleCustomizeWhitelist(interaction);
      else if (interaction.commandName === 'whitelist-panel') await handleWhitelistPanel(interaction);
      else if (interaction.commandName === 'whitelist-key-generate') await handleWhitelistKeyGenerate(interaction);
      else if (interaction.commandName === 'whitelist-add') await handleDirectWhitelist(interaction);
      else if (interaction.commandName === 'whitelist-remove') await handleDirectWhitelist(interaction, true);
      else if (interaction.commandName === 'setup-tracking') await handleSetupTracking(interaction);
      else if (interaction.commandName === 'customize-tracking') await handleCustomizeTracking(interaction);
      else if (interaction.commandName === 'embed-theme-save') await handleEmbedThemeSave(interaction);
      else if (interaction.commandName === 'embed-theme-list') await handleEmbedThemeList(interaction);
      else if (interaction.commandName === 'message-builder') await handleMessageBuilder(interaction);
      else if (interaction.commandName === 'message-edit') await handleMessageEdit(interaction);
      else if (interaction.commandName === 'channel-access' || interaction.commandName === 'channel-access-list') await handleChannelAccessCommand(interaction);
      else if (interaction.commandName === 'maintenance-lock' || interaction.commandName === 'maintenance-unlock') await handleMaintenanceCommand(interaction);
      else if (['balance', 'daily', 'coinflip', 'slots', 'dice', 'roulette', 'coin-leaderboard', 'economy-config', 'economy-reset', 'economy-add', 'economy-remove'].includes(interaction.commandName)) await handleEconomyCommand(interaction);
      else if (['duel', 'duel-leaderboard', 'duel-result'].includes(interaction.commandName)) await handleDuelCommand(interaction);
      else if (organizedModerationCommandNames.has(interaction.commandName)) await handleOrganizedModerationCommand(interaction, { requireTextChannel, canPost, replyPrivately, ensureConfiguration, saveConfigurations });
      return;
    }
    if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_ID) await handleVerify(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(GIVEAWAY_BUTTON_PREFIX)) await handleGiveawayEntry(interaction);
    if (interaction.isButton() && (interaction.customId.startsWith(GIVEAWAY_END_BUTTON_PREFIX) || interaction.customId.startsWith(GIVEAWAY_REFRESH_BUTTON_PREFIX) || interaction.customId.startsWith(GIVEAWAY_PARTICIPANTS_PREFIX))) await handleGiveawayStaffButton(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(POLL_VOTE_PREFIX)) await handlePollVote(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(LIBRARY_PAGE_PREFIX)) await handleLibraryPageButton(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(LIBRARY_PANEL_PREFIX)) await handleLibraryPanelButton(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(LIBRARY_STAFF_PREFIX)) await handleLibraryStaffButton(interaction);
    if (interaction.isButton() && (interaction.customId.startsWith(REQUEST_APPROVE_PREFIX) || interaction.customId.startsWith(REQUEST_DENY_PREFIX))) await handleApprovalButton(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(TICKET_BUTTON_PREFIX)) await handleTicketButton(interaction);
    if (interaction.isButton() && interaction.customId === RIVALS_SIGNUP_BUTTON_ID) await handleRivalsSignup(interaction);
    if (interaction.isButton() && interaction.customId === TICKET_CLOSE_BUTTON_ID) await handleTicketClose(interaction);
    if (interaction.isButton() && [TICKET_CLAIM_BUTTON_ID, TICKET_TRYOUT_ACCEPT_BUTTON_ID, TICKET_TRYOUT_DENY_BUTTON_ID, TICKET_WHITELIST_BUTTON_ID, TICKET_GENERATE_KEYS_BUTTON_ID, TICKET_RENAME_BUTTON_ID].includes(interaction.customId)) await handleTicketControlButton(interaction);
    if (interaction.isButton() && interaction.customId === WHITELIST_BUTTON_ID) await handleWhitelistButton(interaction);
    if (interaction.isButton() && (interaction.customId.startsWith(DUEL_ACCEPT_PREFIX) || interaction.customId.startsWith(DUEL_DECLINE_PREFIX))) await handleDuelButton(interaction);
    if (interaction.isModalSubmit() && interaction.customId === RIVALS_SIGNUP_MODAL_ID) await handleRivalsModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === WHITELIST_MODAL_ID) await handleWhitelistRedeem(interaction);
    if (interaction.isModalSubmit() && interaction.customId === TICKET_WHITELIST_MODAL_ID) await handleTicketWhitelistModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === TICKET_GENERATE_KEYS_MODAL_ID) await handleTicketGenerateKeysModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === TICKET_RENAME_MODAL_ID) await handleTicketRenameModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === DUEL_MODAL_ID) await handleDuelModal(interaction);
  } catch (error) {
    console.error('Interaction failed:', error);
    await replyPrivately(interaction, error instanceof Error ? error.message : 'Unknown error', 'error').catch(() => undefined);
  }
});

async function start() {
  await loadConfigurations();
  await client.login(app.token);
  if (process.env.DISCORD_TOKEN_2?.trim() && !process.env.BOT_SLOT) {
    if (!process.env.CLIENT_ID_2?.trim()) throw new Error('CLIENT_ID_2 is required when DISCORD_TOKEN_2 is configured.');
    const childEnv = {
      ...process.env,
      DISCORD_TOKEN: process.env.DISCORD_TOKEN_2,
      CLIENT_ID: process.env.CLIENT_ID_2,
      DISCORD_TOKEN_2: '',
      CLIENT_ID_2: '',
      BOT_SLOT: '2',
    };
    const secondary = spawn(process.execPath, [process.argv[1]], { env: childEnv, stdio: 'inherit' });
    secondary.on('exit', (code) => console.error(`Secondary bot process exited with code ${code}.`));
    console.log('Secondary bot process started.');
  }
}
start().catch((error) => {
  console.error('Bot failed to start:', error);
  process.exit(1);
});
