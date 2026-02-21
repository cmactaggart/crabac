import { useEffect, useState } from 'react';
import type { TriggerType, CardTemplate } from '@crabac/shared';
import { api } from '../../lib/api.js';
import { useChannelsStore } from '../../stores/channels.js';

interface Props {
  triggerType: TriggerType;
  triggerConfig: Record<string, any> | null;
  onChange: (type: TriggerType, config: Record<string, any> | null) => void;
  spaceId: string;
}

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'member_joined', label: 'Member Joined' },
  { value: 'message_created', label: 'Message Created' },
  { value: 'image_uploaded', label: 'Image Uploaded' },
  { value: 'gpx_uploaded', label: 'GPX Uploaded' },
  { value: 'slash_command', label: 'Slash Command Used' },
  { value: 'card_interaction', label: 'Card Interaction' },
  { value: 'webhook', label: 'Incoming Webhook' },
];

const CHANNEL_TRIGGERS: TriggerType[] = ['message_created', 'image_uploaded', 'gpx_uploaded'];

export function TriggerSelector({ triggerType, triggerConfig, onChange, spaceId }: Props) {
  const channels = useChannelsStore((s) => s.channels);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);

  useEffect(() => {
    if (triggerType === 'card_interaction') {
      api<CardTemplate[]>(`/spaces/${spaceId}/card-templates`)
        .then(setCardTemplates)
        .catch(() => {});
    }
  }, [triggerType, spaceId]);

  const cfg = triggerConfig || {};

  const handleTypeChange = (type: TriggerType) => {
    onChange(type, null);
  };

  const handleConfigChange = (key: string, value: string) => {
    onChange(triggerType, { ...cfg, [key]: value || undefined });
  };

  const spaceChannels = channels.filter((c) => c.spaceId === spaceId);

  return (
    <div style={styles.container}>
      <div style={styles.field}>
        <label style={styles.label}>Trigger Event</label>
        <select
          value={triggerType}
          onChange={(e) => handleTypeChange(e.target.value as TriggerType)}
          style={styles.select}
        >
          {TRIGGER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {CHANNEL_TRIGGERS.includes(triggerType) && (
        <div style={styles.field}>
          <label style={styles.label}>Channel (optional — leave blank for any channel)</label>
          <select
            value={cfg.channelId || ''}
            onChange={(e) => handleConfigChange('channelId', e.target.value)}
            style={styles.select}
          >
            <option value="">Any channel</option>
            {spaceChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {triggerType === 'slash_command' && (
        <div style={styles.field}>
          <label style={styles.label}>Command Name</label>
          <input
            type="text"
            value={cfg.commandName || ''}
            onChange={(e) => handleConfigChange('commandName', e.target.value)}
            placeholder="e.g. register"
            style={styles.input}
          />
          <p style={styles.hint}>Enter the command name without the leading slash.</p>
        </div>
      )}

      {triggerType === 'card_interaction' && (
        <div style={styles.field}>
          <label style={styles.label}>Card Template (optional — leave blank for any)</label>
          <select
            value={cfg.templateId || ''}
            onChange={(e) => handleConfigChange('templateId', e.target.value)}
            style={styles.select}
          >
            <option value="">Any card template</option>
            {cardTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {triggerType === 'webhook' && (
        <div style={styles.field}>
          <label style={styles.label}>Webhook Slug (required)</label>
          <input
            type="text"
            value={cfg.slug || ''}
            onChange={(e) => handleConfigChange('slug', e.target.value)}
            placeholder="e.g. deploy, notify, test"
            style={styles.input}
          />
          <p style={styles.hint}>
            The slug appended to your webhook base URL. Enable webhooks in Public Web settings to get the base URL.
          </p>
        </div>
      )}

      {triggerType === 'member_joined' && (
        <p style={styles.note}>This trigger fires whenever a new member joins the space.</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  select: {
    padding: '7px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
  },
  input: {
    padding: '7px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
  },
  hint: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  note: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
};
