import 'dotenv/config';
import {
  moderationCommands as organizedModerationCommands,
  moderationCommandNames as organizedModerationCommandNames,
  handleModerationCommand as handleOrganizedModerationCommand,
} from './commands/moderation.js';
import { commandGroups } from './commands/groups.js';

import { randomBytes } from 'node:crypto';
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
const WHITELIST_BUTTON_ID = 'whitelist:redeem';
const WHITELIST_MODAL_ID = 'whitelist:key-modal';
const inviteCache = new Map();
const dataFile = join(process.cwd(), 'data', 'guild-config.json');
const timers = new Map();
let guildConfigurations = {};

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
  new SlashCommandBuilder().setName('help').setDescription('Show the bot commands.'),
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
    .addRoleOption((option) => option.setName('winner-role').setDescription('Optional role automatically given to winners')),
  new SlashCommandBuilder()
    .setName('giveaway-end')
    .setDescription('End an active giveaway immediately.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('message-id').setDescription('Giveaway message ID').setRequired(true).setMaxLength(25)),
  new SlashCommandBuilder()
    .setName('giveaway-reroll')
    .setDescription('Pick new winners for a finished giveaway.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('message-id').setDescription('Giveaway message ID').setRequired(true).setMaxLength(25)),
  new SlashCommandBuilder()
    .setName('giveaway-edit')
    .setDescription('Edit an active giveaway using the same giveaway fields.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
    .addRoleOption((option) => option.setName('winner-role').setDescription('Updated winner role')),
  new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Configure private ticket creation for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => option.setName('category').setDescription('Category for newly created tickets').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addRoleOption((option) => option.setName('staff-role').setDescription('Role that can view and reply to tickets').setRequired(true))
    .addRoleOption((option) => option.setName('tryout-role').setDescription('Role given automatically when a Rivals tryout is accepted'))
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
    .setDescription('Customize the Rivals Clan signup panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('title').setDescription('Panel title').setMaxLength(100))
    .addStringOption((option) => option.setName('description').setDescription('Panel description').setMaxLength(1000))
    .addStringOption((option) => option.setName('color').setDescription('Hex color, for example #ED4245').setMaxLength(7))
    .addStringOption((option) => option.setName('footer').setDescription('Panel footer').setMaxLength(200))
    .addStringOption((option) => option.setName('button-label').setDescription('Signup button label').setMaxLength(80)),
  new SlashCommandBuilder()
    .setName('rivals-signup-panel')
    .setDescription('Post the Rivals Clan signup panel.')
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
  ...organizedModerationCommands,
].map((command) => command.toJSON());

const trackingIntentsEnabled = process.env.ENABLE_TRACKING_INTENTS === 'true';
const clientIntents = [GatewayIntentBits.Guilds];
if (trackingIntentsEnabled) clientIntents.push(GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildInvites);
const client = new Client({ intents: clientIntents });
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
    .setTitle(panel.title || 'Rivals Clan Signup')
    .setDescription(panel.description || 'Ready to join Rivals? Press the button and complete a short application. Staff will review it in a private ticket.')
    .setFooter({ text: panel.footer || 'One application per player, please.' })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(RIVALS_SIGNUP_BUTTON_ID).setLabel(panel.buttonLabel || 'Apply to Rivals').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
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
  return new EmbedBuilder()
    .setColor(parseColor(giveaway.color, ended ? 0x747f8d : 0xfee75c))
    .setTitle(giveaway.title || (ended ? 'Giveaway Ended' : '🎉 Giveaway'))
    .setDescription(giveaway.description || `Enter below for a chance to win **${giveaway.prize}**!`)
    .addFields(
      { name: 'Prize', value: giveaway.prize, inline: true },
      { name: 'Winners', value: String(giveaway.winnerCount), inline: true },
      ...(giveaway.winnerRoleId ? [{ name: 'Winner role', value: `<@&${giveaway.winnerRoleId}>`, inline: true }] : []),
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
  )];
}

function helpMessage() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Bot Command Center')
      .setDescription('Everything is grouped below. Setup commands are for staff; member-facing panels can then be posted wherever you need them.')
      .addFields(
        { name: 'Quick start', value: '1. Configure a feature\n2. Customize it (optional)\n3. Post its panel\n4. Use `/help` any time', inline: false },
        { name: 'Verification', value: commandGroups.verification.map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'Giveaways', value: commandGroups.giveaways.map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'Tickets', value: commandGroups.tickets.map((name) => `\`/${name}\``).join('\n'), inline: true },
        { name: 'Rivals + whitelist', value: [...commandGroups.rivals, ...commandGroups.whitelist].map((name) => `\`/${name}\``).join('\n'), inline: true },
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
    name: `${type === 'Rivals Clan Application' ? 'rivals' : 'ticket'}-${safeChannelName(interaction.user.username)}`,
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
  await channel.send(ticket.type === 'Rivals Clan Application' ? tryoutControlPanel() : ticketControlPanel());
  if (details.length) {
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Rivals Application Details').addFields(details).setTimestamp()],
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
  return replyPrivately(interaction, `${panelName === 'rivalsPanel' ? 'Rivals signup' : 'Ticket'} panel customization saved.`);
}

async function handleTicketPanel(interaction, rivals = false) {
  requireAdminServer(interaction);
  const tickets = ticketConfiguration(interaction.guildId);
  await validateTicketSetup(interaction.guild, tickets);
  const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel);
  await canPost(interaction.guild, channel);
  await channel.send(rivals ? rivalsSignupPanel(tickets.rivalsPanel) : ticketPanel(tickets.panel));
  return replyPrivately(interaction, `${rivals ? 'Rivals Clan signup' : 'Ticket'} panel posted in ${channel}.`);
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
    .setTitle('Rivals Clan Application')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('In-game username').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('Platform / region').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('experience').setLabel('Experience and why you want to join').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('availability').setLabel('Usual availability (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)),
    );
}

async function handleRivalsSignup(interaction) {
  if (!ticketConfiguration(interaction.guildId)?.categoryId) return replyPrivately(interaction, 'Rivals applications are not configured yet.', 'error');
  return interaction.showModal(rivalsSignupModal());
}

async function handleRivalsModal(interaction) {
  const details = [
    { name: 'In-game username', value: interaction.fields.getTextInputValue('username') },
    { name: 'Platform / region', value: interaction.fields.getTextInputValue('platform') },
    { name: 'Experience', value: interaction.fields.getTextInputValue('experience') },
    { name: 'Availability', value: interaction.fields.getTextInputValue('availability') || 'Not provided' },
  ];
  return createTicket(interaction, { type: 'Rivals Clan Application', details });
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
    .setDescription(`${entry.ownerMention} is now available. Create a ticket to join UC.`)
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
  if (ticket.type !== 'Rivals Clan Application') throw new Error('Accept and deny are only available in tryout tickets.');
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
  const giveaway = {
    messageId: null,
    channelId: channel.id,
    prize: interaction.options.getString('prize', true),
    description: interaction.options.getString('description') || null,
    title: interaction.options.getString('title') || null,
    color,
    winnerCount: interaction.options.getInteger('winners', true),
    entries: [],
    winnerIds: [],
    keys: [],
    delivery: {},
    rewardFile: rewardFile ? { url: rewardFile.url, name: `${(rewardFile.name || 'reward').replace(/\.[^.]+$/, '')}.${extension}` } : null,
    rewardText: rewardText || null,
    rewardExtension: extension,
    winnerRoleId: winnerRole?.id || null,
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
  requireAdminServer(interaction);
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

async function handleGiveawayEnd(interaction) {
  requireAdminServer(interaction);
  const giveaway = getGiveawayForCommand(interaction);
  if (giveaway.ended) throw new Error('That giveaway has already ended. Use /giveaway-reroll instead.');
  await finishGiveaway(interaction.guildId, giveaway.messageId);
  return replyPrivately(interaction, 'Giveaway ended and winners were selected.');
}

async function handleGiveawayReroll(interaction) {
  requireAdminServer(interaction);
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
  if (giveaway.entries.includes(interaction.user.id)) return replyPrivately(interaction, 'You are already entered in this giveaway.', 'info');
  giveaway.entries.push(interaction.user.id);
  await saveConfigurations();
  return replyPrivately(interaction, `You are entered to win **${giveaway.prize}**!`);
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
  }
});
client.on('guildCreate', (guild) => registerGuildCommands(guild.id).catch((error) => console.error('Command registration failed:', error)));
client.on('inviteCreate', (invite) => cacheGuildInvites(invite.guild).catch(() => undefined));
client.on('inviteDelete', (invite) => cacheGuildInvites(invite.guild).catch(() => undefined));
client.on('guildMemberAdd', (member) => handleMemberJoin(member).catch((error) => console.error('Join tracking failed:', error)));
client.on('guildMemberRemove', (member) => sendMemberTracking(member, false, null).catch((error) => console.error('Leave tracking failed:', error)));

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'help') await interaction.reply({ ...helpMessage(), flags: MessageFlags.Ephemeral });
      else if (interaction.commandName === 'setup-verification') await handleSetup(interaction);
      else if (interaction.commandName === 'customize-verification') await handleCustomize(interaction);
      else if (interaction.commandName === 'verification-panel') await handlePanel(interaction);
      else if (interaction.commandName === 'giveaway-start') await handleGiveawayStart(interaction);
      else if (interaction.commandName === 'giveaway-edit') await handleGiveawayEdit(interaction);
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
      else if (organizedModerationCommandNames.has(interaction.commandName)) await handleOrganizedModerationCommand(interaction, { requireTextChannel, canPost, replyPrivately, ensureConfiguration, saveConfigurations });
      return;
    }
    if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_ID) await handleVerify(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(GIVEAWAY_BUTTON_PREFIX)) await handleGiveawayEntry(interaction);
    if (interaction.isButton() && interaction.customId.startsWith(TICKET_BUTTON_PREFIX)) await handleTicketButton(interaction);
    if (interaction.isButton() && interaction.customId === RIVALS_SIGNUP_BUTTON_ID) await handleRivalsSignup(interaction);
    if (interaction.isButton() && interaction.customId === TICKET_CLOSE_BUTTON_ID) await handleTicketClose(interaction);
    if (interaction.isButton() && [TICKET_CLAIM_BUTTON_ID, TICKET_TRYOUT_ACCEPT_BUTTON_ID, TICKET_TRYOUT_DENY_BUTTON_ID, TICKET_WHITELIST_BUTTON_ID, TICKET_GENERATE_KEYS_BUTTON_ID, TICKET_RENAME_BUTTON_ID].includes(interaction.customId)) await handleTicketControlButton(interaction);
    if (interaction.isButton() && interaction.customId === WHITELIST_BUTTON_ID) await handleWhitelistButton(interaction);
    if (interaction.isModalSubmit() && interaction.customId === RIVALS_SIGNUP_MODAL_ID) await handleRivalsModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === WHITELIST_MODAL_ID) await handleWhitelistRedeem(interaction);
    if (interaction.isModalSubmit() && interaction.customId === TICKET_WHITELIST_MODAL_ID) await handleTicketWhitelistModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === TICKET_GENERATE_KEYS_MODAL_ID) await handleTicketGenerateKeysModal(interaction);
    if (interaction.isModalSubmit() && interaction.customId === TICKET_RENAME_MODAL_ID) await handleTicketRenameModal(interaction);
  } catch (error) {
    console.error('Interaction failed:', error);
    await replyPrivately(interaction, error instanceof Error ? error.message : 'Unknown error', 'error').catch(() => undefined);
  }
});

async function start() {
  await loadConfigurations();
  await client.login(app.token);
}
start().catch((error) => {
  console.error('Bot failed to start:', error);
  process.exit(1);
});
