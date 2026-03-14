import { useState } from 'react';
import type { TriggerType } from '@crabac/shared';

interface Props {
  triggerType: TriggerType;
}

const BASE_VARS = [
  { name: '{{userId}}', desc: 'ID of the triggering user' },
  { name: '{{username}}', desc: 'Username of the triggering user' },
  { name: '{{displayName}}', desc: 'Display name of the triggering user' },
  { name: '{{mention}}', desc: '@mention of the triggering user' },
  { name: '{{spaceName}}', desc: 'Name of the space' },
];

const TRIGGER_VARS: Record<TriggerType, { name: string; desc: string }[]> = {
  member_joined: [
    { name: '{{inviteCode}}', desc: 'Invite code used to join (if any)' },
  ],
  message_created: [
    { name: '{{channelId}}', desc: 'ID of the channel' },
    { name: '{{channelName}}', desc: 'Name of the channel' },
    { name: '{{messageContent}}', desc: 'Text content of the message' },
    { name: '{{messageId}}', desc: 'ID of the message' },
  ],
  image_uploaded: [
    { name: '{{channelId}}', desc: 'ID of the channel' },
    { name: '{{channelName}}', desc: 'Name of the channel' },
    { name: '{{messageId}}', desc: 'ID of the message' },
    { name: '{{imageCount}}', desc: 'Number of images uploaded' },
  ],
  gpx_uploaded: [
    { name: '{{channelId}}', desc: 'ID of the channel' },
    { name: '{{channelName}}', desc: 'Name of the channel' },
    { name: '{{messageId}}', desc: 'ID of the message' },
    { name: '{{gpxCount}}', desc: 'Number of GPX files uploaded' },
  ],
  slash_command: [
    { name: '{{channelId}}', desc: 'ID of the channel' },
    { name: '{{channelName}}', desc: 'Name of the channel' },
    { name: '{{commandName}}', desc: 'Name of the command used' },
    { name: '{{args.*}}', desc: 'Command argument by name, e.g. {{args.username}}' },
  ],
  card_interaction: [
    { name: '{{channelId}}', desc: 'ID of the channel' },
    { name: '{{channelName}}', desc: 'Name of the channel' },
    { name: '{{cardInstanceId}}', desc: 'ID of the card instance' },
    { name: '{{buttonId}}', desc: 'ID of the button clicked' },
    { name: '{{fields.*}}', desc: 'Card field value by key, e.g. {{fields.role}}' },
    { name: '{{card.*}}', desc: 'Original card context, e.g. {{card.userId}}, {{card.args.name}}' },
  ],
  webhook: [
    { name: '{{webhookSlug}}', desc: 'Slug from the webhook URL' },
    { name: '{{webhookMethod}}', desc: 'HTTP method used (GET or POST)' },
    { name: '{{payload.*}}', desc: 'Webhook payload value by key, e.g. {{payload.message}}, {{payload.data.id}}' },
  ],
};

export function VariableHelp({ triggerType }: Props) {
  const [open, setOpen] = useState(false);
  const extraVars = TRIGGER_VARS[triggerType] || [];
  const allVars = [...BASE_VARS, ...extraVars];

  return (
    <div style={styles.container}>
      <button onClick={() => setOpen((v) => !v)} style={styles.toggle}>
        <span style={styles.toggleIcon}>{open ? '▾' : '▸'}</span>
        Available Variables
      </button>
      {open && (
        <div style={styles.panel}>
          <div style={styles.grid}>
            {allVars.map((v) => (
              <div key={v.name} style={styles.row}>
                <code style={styles.varName}>{v.name}</code>
                <span style={styles.varDesc}>{v.desc}</span>
              </div>
            ))}
          </div>
          <p style={styles.hint}>
            Use these placeholders in message content. Dynamic keys like{' '}
            <code style={styles.inlineCode}>args.*</code> and{' '}
            <code style={styles.inlineCode}>fields.*</code> replace <code style={styles.inlineCode}>*</code> with the actual key name.
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  toggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  toggleIcon: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  panel: {
    padding: '10px 12px',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
  },
  varName: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: 'var(--accent)',
    background: 'var(--bg-tertiary)',
    padding: '1px 5px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minWidth: 180,
  },
  varDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  hint: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: 'var(--accent)',
    background: 'var(--bg-tertiary)',
    padding: '0 3px',
    borderRadius: 3,
  },
};
