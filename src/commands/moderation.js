import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const moderationCommands = [
  new SlashCommandBuilder().setName('addrole').setDescription('Add a role to a member.').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('removerole').setDescription('Remove a role from a member.').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member.').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('delete-days').setDescription('Delete message history, 0-7 days').setMinValue(0).setMaxValue(7)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('softban').setDescription('Ban then unban a member.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addStringOption((o) => o.setName('user-id').setDescription('User ID').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('untimeout').setDescription('Remove a member timeout.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('mute').setDescription('Mute a member for seconds, minutes, hours, days, years, or forever.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('duration').setDescription('Amount, 30s/10m/1y, or perm').setRequired(true).setMaxLength(30)).addStringOption((o) => o.setName('unit').setDescription('Pick a unit when duration is only a number').addChoices({ name: 'Seconds', value: 'seconds' }, { name: 'Minutes', value: 'minutes' }, { name: 'Hours', value: 'hours' }, { name: 'Days', value: 'days' }, { name: 'Years', value: 'years' }, { name: 'Forever', value: 'forever' })).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('unmute').setDescription('Unmute a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('warnings').setDescription('View a member warning history.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('warning-book').setDescription('Open the full warning book for a member.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('remove-warning').setDescription('Remove one warning by its warning ID.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('warning-id').setDescription('Warning ID from /warnings').setRequired(true).setMaxLength(20)),
  new SlashCommandBuilder().setName('clear-warnings').setDescription('Clear a member warning history.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Delete recent messages.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption((o) => o.setName('amount').setDescription('1-100 messages').setRequired(true).setMinValue(1).setMaxValue(100)).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('purge').setDescription('Delete recent messages.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption((o) => o.setName('amount').setDescription('1-100 messages').setRequired(true).setMinValue(1).setMaxValue(100)).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('lock').setDescription('Lock a channel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addIntegerOption((o) => o.setName('seconds').setDescription('0-21600 seconds').setRequired(true).setMinValue(0).setMaxValue(21600)).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('setnick').setDescription('Set a member nickname.').setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)).addStringOption((o) => o.setName('nickname').setDescription('New nickname').setRequired(true).setMaxLength(32)),
  new SlashCommandBuilder().setName('resetnick').setDescription('Reset a member nickname.').setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('deafen').setDescription('Deafen a voice member.').setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers).addUserOption((o) => o.setName('user').setDescription('Voice member').setRequired(true)),
  new SlashCommandBuilder().setName('undeafen').setDescription('Undeafen a voice member.').setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers).addUserOption((o) => o.setName('user').setDescription('Voice member').setRequired(true)),
  new SlashCommandBuilder().setName('move').setDescription('Move a member to a voice channel.').setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers).addUserOption((o) => o.setName('user').setDescription('Voice member').setRequired(true)).addChannelOption((o) => o.setName('channel').setDescription('Voice channel').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true)),
  new SlashCommandBuilder().setName('roleinfo').setDescription('Show role information.').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
  new SlashCommandBuilder().setName('userinfo').setDescription('Show member information.').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show server information.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('announce').setDescription('Send a mod announcement embed.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addStringOption((o) => o.setName('title').setDescription('Title').setRequired(true).setMaxLength(256)).addStringOption((o) => o.setName('message').setDescription('Announcement').setRequired(true).setMaxLength(4000)).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('say').setDescription('Send a plain staff message.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addStringOption((o) => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(2000)).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('hide').setDescription('Hide a channel from everyone.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('unhide').setDescription('Show a channel to everyone.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addChannelOption((o) => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
];

export const moderationCommandNames = new Set(moderationCommands.map((command) => command.name));

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function parseMuteDuration(input, selectedUnit) {
  let value = String(input || '').trim().toLowerCase();
  if (selectedUnit === 'forever') value = 'forever';
  else if (selectedUnit && /^\d+(?:\.\d+)?$/.test(value)) value += ({ seconds: 's', minutes: 'm', hours: 'h', days: 'd', years: 'y' })[selectedUnit];
  if (['perm', 'permanent', 'forever'].includes(value)) return { milliseconds: null, label: 'forever' };
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|y|yr|yrs|year|years)$/);
  if (!match) throw new Error('Enter a duration such as `30s`, `10m`, `2h`, `7d`, `1y`, or `forever`. Prefix permanent mute: `mute @user perm`.');
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Mute duration must be greater than zero.');
  const unit = match[2][0];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000, y: 31_557_600_000 };
  const milliseconds = Math.round(amount * multipliers[unit]);
  if (milliseconds > 10 * multipliers.y) throw new Error('Timed mutes can be at most 10 years. Use `forever` for a permanent mute.');
  return { milliseconds, label: value };
}

const muteChannelDenials = {
  ViewChannel: false,
  SendMessages: false,
  AddReactions: false,
  Speak: false,
  Connect: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
};

export async function applyMuteRoleToChannel(channel, roleId) {
  if (!channel?.permissionOverwrites || !roleId) return;
  await channel.permissionOverwrites.edit(roleId, muteChannelDenials, { reason: 'Block Muted role from channel access' });
}

async function mutedRole(guild, config) {
  let role = config.moderationMuteRoleId ? guild.roles.cache.get(config.moderationMuteRoleId) : null;
  if (!role) {
    role = guild.roles.cache.find((item) => item.name === 'Muted' && !item.managed)
      || await guild.roles.create({ name: 'Muted', permissions: [], reason: 'Permanent and long-duration mute support' });
    config.moderationMuteRoleId = role.id;
  }
  await Promise.allSettled(guild.channels.cache.map((channel) => applyMuteRoleToChannel(channel, role.id)));
  return role;
}

export async function sweepExpiredMutes(client, tools) {
  let changed = false;
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    const config = tools.ensureConfiguration(guild.id);
    config.moderationMutes ||= {};
    for (const [memberId, mute] of Object.entries(config.moderationMutes)) {
      if (!mute.expiresAt || mute.expiresAt > now) continue;
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member && config.moderationMuteRoleId) await member.roles.remove(config.moderationMuteRoleId, 'Timed mute expired').catch(() => undefined);
      delete config.moderationMutes[memberId];
      changed = true;
    }
  }
  if (changed) await tools.saveConfigurations();
}

export async function handleModerationCommand(interaction, tools) {
  const { requireTextChannel, canPost, replyPrivately, ensureConfiguration, saveConfigurations } = tools;
  const requirePermission = (permission) => {
    if (!interaction.guild || !interaction.guildId) throw new Error('This moderation command only works in a server.');
    if (!interaction.memberPermissions?.has(permission)) throw new Error('You do not have permission to use this moderation command.');
  };
  const member = async () => {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
    const bot = await interaction.guild.members.fetchMe();
    if (target.id === interaction.user.id) throw new Error('You cannot moderate yourself.');
    if (target.id === bot.id || target.roles.highest.comparePositionTo(bot.roles.highest) >= 0) throw new Error('That member is above my role hierarchy.');
    return target;
  };
  const reason = () => interaction.options.getString('reason') || `Moderator: ${interaction.user.tag}`;
  const name = interaction.commandName;

  if (['addrole', 'removerole'].includes(name)) {
    requirePermission(PermissionFlagsBits.ManageRoles); const target = await member(); const role = interaction.options.getRole('role', true); const bot = await interaction.guild.members.fetchMe();
    if (role.managed || role.id === interaction.guild.id || bot.roles.highest.comparePositionTo(role) <= 0) throw new Error('That role cannot be managed by me.');
    if (name === 'addrole') await target.roles.add(role, reason()); else await target.roles.remove(role, reason());
    return replyPrivately(interaction, `${name === 'addrole' ? 'Added' : 'Removed'} ${role} ${name === 'addrole' ? 'to' : 'from'} ${target}.`);
  }
  if (['kick', 'ban', 'softban'].includes(name)) {
    requirePermission(name === 'kick' ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.BanMembers); const target = await member(); const why = reason();
    if (name === 'kick') await target.kick(why); else { await target.ban({ deleteMessageSeconds: (interaction.options.getInteger('delete-days') || 0) * 86400, reason: why }); if (name === 'softban') await interaction.guild.bans.remove(target.id, why); }
    return replyPrivately(interaction, `${name} completed for ${target}.`);
  }
  if (name === 'unban') { requirePermission(PermissionFlagsBits.BanMembers); await interaction.guild.bans.remove(interaction.options.getString('user-id', true), reason()); return replyPrivately(interaction, 'User unbanned.'); }
  if (['timeout', 'mute', 'untimeout', 'unmute'].includes(name)) {
    requirePermission(PermissionFlagsBits.ModerateMembers); const target = await member();
    if (name === 'timeout') await target.timeout(interaction.options.getInteger('minutes', true) * 60_000, reason());
    else if (name === 'mute') {
      const duration = parseMuteDuration(interaction.options.getString('duration', true), interaction.options.getString('unit'));
      if (duration.milliseconds !== null && duration.milliseconds <= MAX_TIMEOUT_MS) {
        await target.timeout(duration.milliseconds, reason());
      } else {
        const config = ensureConfiguration(interaction.guildId);
        config.moderationMutes ||= {};
        const role = await mutedRole(interaction.guild, config);
        await target.roles.add(role, reason());
        config.moderationMutes[target.id] = { expiresAt: duration.milliseconds === null ? null : Date.now() + duration.milliseconds, moderatorId: interaction.user.id, reason: reason() };
        await saveConfigurations();
      }
      return replyPrivately(interaction, `${target} was muted for **${duration.label}**.`);
    } else {
      await target.timeout(null, reason());
      if (name === 'unmute') {
        const config = ensureConfiguration(interaction.guildId);
        if (config.moderationMuteRoleId) await target.roles.remove(config.moderationMuteRoleId, reason()).catch(() => undefined);
        if (config.moderationMutes?.[target.id]) { delete config.moderationMutes[target.id]; await saveConfigurations(); }
      }
    }
    return replyPrivately(interaction, `${name} completed for ${target}.`);
  }
  if (name === 'warn') {
    requirePermission(PermissionFlagsBits.ModerateMembers); const target = await member(); const config = ensureConfiguration(interaction.guildId); config.warnings[target.id] ||= [];
    config.warnings[target.id].push({ id: `W-${Date.now().toString(36).toUpperCase()}`, reason: interaction.options.getString('reason', true), moderator: interaction.user.id, at: Date.now() }); await saveConfigurations();
    return replyPrivately(interaction, `${target} has been warned. Warning ID: \`${config.warnings[target.id].at(-1).id}\`\nWarning count: ${config.warnings[target.id].length}.`);
  }
  if (['warnings', 'warning-book', 'clear-warnings', 'remove-warning'].includes(name)) {
    requirePermission(PermissionFlagsBits.ModerateMembers); const user = interaction.options.getUser('user', true); const config = ensureConfiguration(interaction.guildId); const list = config.warnings[user.id] || [];
    if (name === 'clear-warnings') { delete config.warnings[user.id]; await saveConfigurations(); return replyPrivately(interaction, `Cleared warnings for ${user}.`); }
    if (name === 'remove-warning') { const warningId = interaction.options.getString('warning-id', true).toUpperCase(); const index = list.findIndex((w, i) => (w.id || `W-${i + 1}`) === warningId); if (index < 0) throw new Error(`No warning with ID \`${warningId}\` was found for ${user}.`); list.splice(index, 1); await saveConfigurations(); return replyPrivately(interaction, `Removed warning \`${warningId}\` from ${user}.`); }
    return replyPrivately(interaction, list.length ? `${user} has **${list.length}** warning(s).\n\n${list.map((w, i) => `**${w.id || `W-${i + 1}`}** • <t:${Math.floor(w.at / 1000)}:d>\n${w.reason}`).join('\n\n')}` : `${user} has no warnings.`, 'info');
  }
  if (['clear', 'purge'].includes(name)) { requirePermission(PermissionFlagsBits.ManageMessages); const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel); const deleted = await channel.bulkDelete(interaction.options.getInteger('amount', true), true); return replyPrivately(interaction, `Deleted ${deleted.size} message(s) from ${channel}.`); }
  if (['lock', 'unlock', 'hide', 'unhide'].includes(name)) { requirePermission(PermissionFlagsBits.ManageChannels); const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel); const everyone = interaction.guild.roles.everyone; if (['lock', 'unlock'].includes(name)) await channel.permissionOverwrites.edit(everyone, { SendMessages: name === 'lock' ? false : null }); else await channel.permissionOverwrites.edit(everyone, { ViewChannel: name === 'hide' ? false : null }); return replyPrivately(interaction, `${channel} ${name} completed.`); }
  if (name === 'slowmode') { requirePermission(PermissionFlagsBits.ManageChannels); const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel); await channel.setRateLimitPerUser(interaction.options.getInteger('seconds', true)); return replyPrivately(interaction, `Slowmode updated in ${channel}.`); }
  if (['setnick', 'resetnick'].includes(name)) { requirePermission(PermissionFlagsBits.ManageNicknames); const target = await member(); await target.setNickname(name === 'setnick' ? interaction.options.getString('nickname', true) : null, reason()); return replyPrivately(interaction, `Nickname ${name === 'setnick' ? 'updated' : 'reset'} for ${target}.`); }
  if (['deafen', 'undeafen'].includes(name)) { requirePermission(PermissionFlagsBits.DeafenMembers); const target = await member(); if (!target.voice.channel) throw new Error('That member is not in a voice channel.'); await target.voice.setDeaf(name === 'deafen', reason()); return replyPrivately(interaction, `${name} completed for ${target}.`); }
  if (name === 'move') { requirePermission(PermissionFlagsBits.MoveMembers); const target = await member(); const channel = interaction.options.getChannel('channel', true); await target.voice.setChannel(channel, reason()); return replyPrivately(interaction, `Moved ${target} to ${channel}.`); }
  if (name === 'roleinfo') { requirePermission(PermissionFlagsBits.ManageRoles); const role = interaction.options.getRole('role', true); return replyPrivately(interaction, `**${role.name}**\nID: \`${role.id}\`\nMembers: **${role.members.size}**\nPosition: **${role.position}**`, 'info'); }
  if (name === 'userinfo') { requirePermission(PermissionFlagsBits.ModerateMembers); const target = await member(); return replyPrivately(interaction, `**${target.user.tag}**\nID: \`${target.id}\`\nJoined: <t:${Math.floor(target.joinedTimestamp / 1000)}:F>\nRoles: ${target.roles.cache.filter((role) => role.id !== interaction.guild.id).map((role) => role.name).join(', ') || 'None'}`, 'info'); }
  if (name === 'serverinfo') { requirePermission(PermissionFlagsBits.ManageGuild); return replyPrivately(interaction, `**${interaction.guild.name}**\nMembers: **${interaction.guild.memberCount}**\nChannels: **${interaction.guild.channels.cache.size}**\nRoles: **${interaction.guild.roles.cache.size}**`, 'info'); }
  if (name === 'announce') { requirePermission(PermissionFlagsBits.ManageMessages); const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel); await canPost(interaction.guild, channel); await channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(interaction.options.getString('title', true)).setDescription(interaction.options.getString('message', true)).setFooter({ text: `Posted by ${interaction.user.tag}` }).setTimestamp()] }); return replyPrivately(interaction, `Announcement sent to ${channel}.`); }
  if (name === 'say') { requirePermission(PermissionFlagsBits.ManageMessages); const channel = requireTextChannel(interaction.options.getChannel('channel') || interaction.channel); await canPost(interaction.guild, channel); await channel.send({ content: interaction.options.getString('message', true) }); return replyPrivately(interaction, `Message sent to ${channel}.`); }
  throw new Error('Unknown moderation command.');
}
