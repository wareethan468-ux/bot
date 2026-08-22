// Compatibility entry point for the root bot. Keep the moderation implementation
// in one place so local and hosted startup paths always expose the same exports.
export * from '../src/commands/moderation.js';
