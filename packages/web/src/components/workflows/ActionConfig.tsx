import { useEffect, useState } from 'react';
import type { WorkflowAction, ActionType, CardTemplate } from '@crabac/shared';
import type { Role } from '@crabac/shared';
import { api } from '../../lib/api.js';
import { useChannelsStore } from '../../stores/channels.js';

interface Props {
  action: WorkflowAction;
  onChange: (action: WorkflowAction) => void;
  spaceId: string;
}

const ACTION_LABELS: Record<ActionType, string> = {
  send_message: 'Send Message',
  send_admin_message: 'Send Admin Message',
  add_role: 'Add Role',
  remove_role: 'Remove Role',
  copy_images_to_gallery: 'Copy Images to Gallery',
  copy_routes_to_library: 'Copy Routes to Library',
  show_card: 'Show Card',
  update_card: 'Update Card',
  dismiss_card: 'Dismiss Card',
  send_webhook: 'Send Outgoing Webhook',
};

export const ACTION_OPTIONS: { value: ActionType; label: string }[] = Object.entries(ACTION_LABELS).map(
  ([value, label]) => ({ value: value as ActionType, label }),
);

function useRoles(spaceId: string) {
  const [roles, setRoles] = useState<Role[]>([]);
  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`)
      .then(setRoles)
      .catch(() => {});
  }, [spaceId]);
  return roles;
}

function useCardTemplates(spaceId: string) {
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  useEffect(() => {
    api<CardTemplate[]>(`/spaces/${spaceId}/workflows/card-templates`)
      .then(setTemplates)
      .catch(() => {});
  }, [spaceId]);
  return templates;
}

export function ActionConfig({ action, onChange, spaceId }: Props) {
  const channels = useChannelsStore((s) => s.channels);
  const roles = useRoles(spaceId);
  const cardTemplates = useCardTemplates(spaceId);

  const spaceChannels = channels.filter((c) => c.spaceId === spaceId);
  const galleryChannels = spaceChannels.filter((c) => c.type === 'media_gallery');
  const libraryChannels = spaceChannels.filter((c) => c.type === 'route_library');

  const cfg = action.config || {};

  const setConfig = (updates: Record<string, any>) => {
    onChange({ ...action, config: { ...cfg, ...updates } });
  };

  const setFieldUpdate = (key: string, value: string) => {
    const fieldUpdates = { ...(cfg.fieldUpdates || {}) };
    if (value === '') {
      delete fieldUpdates[key];
    } else {
      fieldUpdates[key] = value;
    }
    setConfig({ fieldUpdates });
  };

  if (action.type === 'send_message') {
    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Message Style</label>
          <select
            value={cfg.messageStyle || 'normal'}
            onChange={(e) => setConfig({ messageStyle: e.target.value })}
            style={styles.select}
          >
            <option value="normal">Normal (appears as regular message)</option>
            <option value="system">System (italic, muted)</option>
          </select>
        </div>
        {(cfg.messageStyle || 'normal') === 'normal' && (
          <div style={styles.field}>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              value={cfg.displayName || ''}
              onChange={(e) => setConfig({ displayName: e.target.value })}
              placeholder='e.g. "SpaghettiBot" — supports {{variables}}'
              style={styles.input}
            />
            <span style={styles.hint}>
              The name shown on the message. Not a real user — no profile card.
            </span>
          </div>
        )}
        <div style={styles.field}>
          <label style={styles.label}>Channel (optional — defaults to trigger channel)</label>
          <select
            value={cfg.channelId || ''}
            onChange={(e) => setConfig({ channelId: e.target.value || undefined })}
            style={styles.select}
          >
            <option value="">Trigger channel</option>
            {spaceChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Message Content</label>
          <textarea
            value={cfg.content || ''}
            onChange={(e) => setConfig({ content: e.target.value })}
            placeholder="Use {{variables}} for dynamic content"
            rows={3}
            style={styles.textarea}
          />
        </div>
      </div>
    );
  }

  if (action.type === 'send_admin_message') {
    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Message Style</label>
          <select
            value={cfg.messageStyle || 'normal'}
            onChange={(e) => setConfig({ messageStyle: e.target.value })}
            style={styles.select}
          >
            <option value="normal">Normal (appears as regular message)</option>
            <option value="system">System (italic, muted)</option>
          </select>
        </div>
        {(cfg.messageStyle || 'normal') === 'normal' && (
          <div style={styles.field}>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              value={cfg.displayName || ''}
              onChange={(e) => setConfig({ displayName: e.target.value })}
              placeholder='e.g. "AdminBot" — supports {{variables}}'
              style={styles.input}
            />
            <span style={styles.hint}>
              The name shown on the message. Not a real user — no profile card.
            </span>
          </div>
        )}
        <div style={styles.field}>
          <label style={styles.label}>Message Content</label>
          <textarea
            value={cfg.content || ''}
            onChange={(e) => setConfig({ content: e.target.value })}
            placeholder="Use {{variables}} for dynamic content"
            rows={3}
            style={styles.textarea}
          />
        </div>
      </div>
    );
  }

  if (action.type === 'add_role' || action.type === 'remove_role') {
    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Target User</label>
          <input
            type="text"
            value={cfg.targetUserId || ''}
            onChange={(e) => setConfig({ targetUserId: e.target.value || undefined })}
            placeholder="{{userId}} — leave blank for triggering user"
            style={styles.input}
          />
          <span style={styles.hint}>
            User to {action.type === 'add_role' ? 'add the role to' : 'remove the role from'}.
            Use {'{{variables}}'} like {'{{card.userId}}'} or {'{{fields.user}}'}.
            Blank = the user who triggered the workflow.
          </span>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Role (pick one method)</label>
          <select
            value={cfg.roleId || ''}
            onChange={(e) => setConfig({ roleId: e.target.value, roleVariable: undefined })}
            style={styles.select}
          >
            <option value="">Select a specific role...</option>
            {roles
              .filter((r) => !r.isSystem)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
          <span style={styles.hint}>— or use a variable —</span>
          <input
            type="text"
            value={cfg.roleVariable || ''}
            onChange={(e) => setConfig({ roleVariable: e.target.value || undefined, roleId: e.target.value ? undefined : cfg.roleId })}
            placeholder='e.g. {{fields.role}} or {{card.roleId}}'
            style={styles.input}
          />
          <span style={styles.hint}>
            A role ID from a card field or variable. Overrides the dropdown above if set.
          </span>
        </div>
      </div>
    );
  }

  if (action.type === 'copy_images_to_gallery') {
    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Gallery Channel</label>
          <select
            value={cfg.galleryChannelId || ''}
            onChange={(e) => setConfig({ galleryChannelId: e.target.value })}
            style={styles.select}
          >
            <option value="">Select a gallery channel...</option>
            {galleryChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
          {galleryChannels.length === 0 && (
            <p style={styles.hint}>No media gallery channels found in this space.</p>
          )}
        </div>
      </div>
    );
  }

  if (action.type === 'copy_routes_to_library') {
    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Route Library Channel</label>
          <select
            value={cfg.routeLibraryChannelId || ''}
            onChange={(e) => setConfig({ routeLibraryChannelId: e.target.value })}
            style={styles.select}
          >
            <option value="">Select a route library channel...</option>
            {libraryChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
          {libraryChannels.length === 0 && (
            <p style={styles.hint}>No route library channels found in this space.</p>
          )}
        </div>
      </div>
    );
  }

  if (action.type === 'show_card') {
    const templateArgs: Record<string, string> = cfg.templateArgs || {};
    const argKeys = Object.keys(templateArgs);
    const displayArgKeys = argKeys.length > 0 ? argKeys : [];

    const setTemplateArg = (key: string, value: string, oldKey?: string) => {
      const newArgs = { ...templateArgs };
      if (oldKey !== undefined && oldKey !== key) delete newArgs[oldKey];
      if (key === '' && value === '') {
        if (oldKey) delete newArgs[oldKey];
      } else {
        newArgs[key] = value;
      }
      setConfig({ templateArgs: Object.keys(newArgs).length > 0 ? newArgs : undefined });
    };

    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>Card Template</label>
          <select
            value={cfg.templateId || ''}
            onChange={(e) => setConfig({ templateId: e.target.value })}
            style={styles.select}
          >
            <option value="">Select a template...</option>
            {cardTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Channel (optional — defaults to trigger channel)</label>
          <select
            value={cfg.channelId || ''}
            onChange={(e) => setConfig({ channelId: e.target.value || undefined })}
            style={styles.select}
          >
            <option value="">Trigger channel</option>
            {spaceChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Template Arguments</label>
          <span style={styles.hint}>
            Pass extra variables into the card template. Values support {'{{variables}}'} from the trigger context.
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {displayArgKeys.map((key, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setTemplateArg(e.target.value, templateArgs[key] || '', key)}
                  placeholder="Variable name"
                  style={{ ...styles.input, flex: 1 }}
                />
                <input
                  type="text"
                  value={templateArgs[key] || ''}
                  onChange={(e) => setTemplateArg(key, e.target.value)}
                  placeholder='Value (e.g. {{args.name}})'
                  style={{ ...styles.input, flex: 2 }}
                />
                <button
                  onClick={() => {
                    const newArgs = { ...templateArgs };
                    delete newArgs[key];
                    setConfig({ templateArgs: Object.keys(newArgs).length > 0 ? newArgs : undefined });
                  }}
                  style={styles.removeBtn}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newArgs = { ...templateArgs, '': '' };
                setConfig({ templateArgs: newArgs });
              }}
              style={styles.addFieldBtn}
            >
              + Add Template Argument
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (action.type === 'update_card') {
    const fieldUpdates: Record<string, string> = cfg.fieldUpdates || {};
    const fieldKeys = Object.keys(fieldUpdates);
    // Always show at least one empty row to add a new field
    const displayKeys = fieldKeys.length > 0 ? fieldKeys : [''];

    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>New Title (optional)</label>
          <input
            type="text"
            value={cfg.title || ''}
            onChange={(e) => setConfig({ title: e.target.value || undefined })}
            placeholder="Leave blank to keep existing title"
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>New Body (optional)</label>
          <textarea
            value={cfg.body || ''}
            onChange={(e) => setConfig({ body: e.target.value || undefined })}
            placeholder="Leave blank to keep existing body"
            rows={2}
            style={styles.textarea}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Field Updates</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {displayKeys.map((key, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    const newUpdates = { ...fieldUpdates };
                    delete newUpdates[key];
                    if (newKey) newUpdates[newKey] = fieldUpdates[key] || '';
                    setConfig({ fieldUpdates: newUpdates });
                  }}
                  placeholder="Field key"
                  style={{ ...styles.input, flex: 1 }}
                />
                <input
                  type="text"
                  value={fieldUpdates[key] || ''}
                  onChange={(e) => setFieldUpdate(key, e.target.value)}
                  placeholder="New value"
                  style={{ ...styles.input, flex: 2 }}
                />
                <button
                  onClick={() => {
                    const newUpdates = { ...fieldUpdates };
                    delete newUpdates[key];
                    setConfig({ fieldUpdates: newUpdates });
                  }}
                  style={styles.removeBtn}
                  title="Remove field"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newUpdates = { ...fieldUpdates, '': '' };
                setConfig({ fieldUpdates: newUpdates });
              }}
              style={styles.addFieldBtn}
            >
              + Add Field Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (action.type === 'dismiss_card') {
    return (
      <p style={styles.noConfig}>No configuration needed — dismisses the triggering card.</p>
    );
  }

  if (action.type === 'send_webhook') {
    const customHeaders: Record<string, string> = cfg.headers || {};
    const headerKeys = Object.keys(customHeaders);

    const setHeader = (key: string, value: string, oldKey?: string) => {
      const newHeaders = { ...customHeaders };
      if (oldKey !== undefined && oldKey !== key) delete newHeaders[oldKey];
      if (key === '' && value === '') {
        if (oldKey) delete newHeaders[oldKey];
      } else {
        newHeaders[key] = value;
      }
      setConfig({ headers: Object.keys(newHeaders).length > 0 ? newHeaders : undefined });
    };

    return (
      <div style={styles.fields}>
        <div style={styles.field}>
          <label style={styles.label}>URL</label>
          <input
            type="text"
            value={cfg.url || ''}
            onChange={(e) => setConfig({ url: e.target.value })}
            placeholder="https://example.com/webhook — supports {{variables}}"
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Method</label>
          <select
            value={cfg.method || 'POST'}
            onChange={(e) => setConfig({ method: e.target.value })}
            style={styles.select}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
        {(cfg.method || 'POST') !== 'GET' && (
          <div style={styles.field}>
            <label style={styles.label}>Body Template</label>
            <textarea
              value={cfg.body || ''}
              onChange={(e) => setConfig({ body: e.target.value })}
              placeholder={'{"text": "{{messageContent}}", "user": "{{username}}"}'}
              rows={4}
              style={styles.textarea}
            />
            <span style={styles.hint}>JSON body with {'{{variable}}'} interpolation.</span>
          </div>
        )}
        <div style={styles.field}>
          <label style={styles.label}>Custom Headers (optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {headerKeys.map((key, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setHeader(e.target.value, customHeaders[key] || '', key)}
                  placeholder="Header name"
                  style={{ ...styles.input, flex: 1 }}
                />
                <input
                  type="text"
                  value={customHeaders[key] || ''}
                  onChange={(e) => setHeader(key, e.target.value)}
                  placeholder="Value"
                  style={{ ...styles.input, flex: 2 }}
                />
                <button
                  onClick={() => {
                    const newH = { ...customHeaders };
                    delete newH[key];
                    setConfig({ headers: Object.keys(newH).length > 0 ? newH : undefined });
                  }}
                  style={styles.removeBtn}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setConfig({ headers: { ...customHeaders, '': '' } })}
              style={styles.addFieldBtn}
            >
              + Add Header
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  select: {
    padding: '6px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
  },
  input: {
    padding: '6px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
  },
  textarea: {
    padding: '6px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  hint: {
    margin: 0,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  noConfig: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  removeBtn: {
    padding: '4px 8px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
  },
  addFieldBtn: {
    alignSelf: 'flex-start',
    padding: '5px 10px',
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
};
