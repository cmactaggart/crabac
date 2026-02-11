export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'shrug', description: 'Appends \u00AF\\_(\u30C4)_/\u00AF to your message', usage: '/shrug [text]' },
  { name: 'tableflip', description: 'Appends (\u256F\u00B0\u25A1\u00B0)\u256F\uFE35 \u253B\u2501\u253B to your message', usage: '/tableflip [text]' },
  { name: 'unflip', description: 'Appends \u252C\u2500\u252C \u30CE( \u309C-\u309C\u30CE) to your message', usage: '/unflip [text]' },
  { name: 'me', description: 'Sends an action message in italics', usage: '/me [action]' },
  { name: 'lenny', description: 'Appends ( \u0361\u00B0 \u035C\u0296 \u0361\u00B0) to your message', usage: '/lenny [text]' },
];

export function parseSlashCommand(input: string): { command: string; output: string } | null {
  const match = input.match(/^\/(\w+)(?:\s+(.*))?$/);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const args = match[2]?.trim() || '';

  switch (command) {
    case 'shrug':
      return { command, output: args ? `${args} \u00AF\\_(\u30C4)_/\u00AF` : '\u00AF\\_(\u30C4)_/\u00AF' };
    case 'tableflip':
      return { command, output: args ? `${args} (\u256F\u00B0\u25A1\u00B0)\u256F\uFE35 \u253B\u2501\u253B` : '(\u256F\u00B0\u25A1\u00B0)\u256F\uFE35 \u253B\u2501\u253B' };
    case 'unflip':
      return { command, output: args ? `${args} \u252C\u2500\u252C \u30CE( \u309C-\u309C\u30CE)` : '\u252C\u2500\u252C \u30CE( \u309C-\u309C\u30CE)' };
    case 'me':
      return { command, output: args ? `*${args}*` : '*...*' };
    case 'lenny':
      return { command, output: args ? `${args} ( \u0361\u00B0 \u035C\u0296 \u0361\u00B0)` : '( \u0361\u00B0 \u035C\u0296 \u0361\u00B0)' };
    default:
      return null;
  }
}
