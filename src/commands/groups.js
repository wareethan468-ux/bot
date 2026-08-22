/** Command groups used by the help center and future command modules. */
export const commandGroups = Object.freeze({
  verification: ['setup-verification', 'customize-verification', 'verification-panel'],
  giveaways: ['giveaway-start', 'giveaway-edit', 'giveaway-end', 'giveaway-reroll'],
  tickets: ['setup-tickets', 'customize-tickets', 'ticket-panel', 'ticket-close'],
  rivals: ['customize-rivals-signup', 'rivals-signup-panel'],
  whitelist: ['setup-whitelist', 'customize-whitelist', 'whitelist-key-generate', 'whitelist-panel', 'whitelist-add', 'whitelist-remove'],
  tracking: ['setup-tracking', 'customize-tracking'],
  messaging: ['message-builder', 'message-edit', 'embed-theme-save', 'embed-theme-list'],
});

export const allFeatureCommandNames = new Set(Object.values(commandGroups).flat());
