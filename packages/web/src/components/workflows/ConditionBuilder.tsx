import { useEffect, useState } from 'react';
import type { ConditionGroup, ConditionRule, ConditionType } from '@crabac/shared';
import type { Role } from '@crabac/shared';
import { api } from '../../lib/api.js';
import { useChannelsStore } from '../../stores/channels.js';

interface Props {
  conditions: ConditionGroup | null;
  onChange: (conditions: ConditionGroup | null) => void;
  spaceId: string;
}

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'user_has_role', label: 'User Has Role' },
  { value: 'channel_is', label: 'Channel Is' },
  { value: 'message_contains', label: 'Message Contains' },
  { value: 'message_equals', label: 'Message Equals' },
  { value: 'command_arg_equals', label: 'Command Arg Equals' },
  { value: 'card_field_equals', label: 'Card Field Equals' },
  { value: 'card_field_not_null', label: 'Card Field Not Null' },
  { value: 'invite_code_is', label: 'Invite Code Is' },
  { value: 'button_is', label: 'Button Clicked Is' },
  { value: 'webhook_payload_equals', label: 'Webhook Payload Equals' },
];

function isGroup(item: ConditionRule | ConditionGroup): item is ConditionGroup {
  return 'operator' in item && 'rules' in item;
}

function defaultRule(): ConditionRule {
  return { type: 'message_contains', config: {}, negate: false };
}

function defaultGroup(): ConditionGroup {
  return { operator: 'AND', rules: [defaultRule()] };
}

interface RuleEditorProps {
  rule: ConditionRule;
  onChange: (rule: ConditionRule) => void;
  onRemove: () => void;
  roles: Role[];
  spaceId: string;
}

function RuleEditor({ rule, onChange, onRemove, roles, spaceId }: RuleEditorProps) {
  const channels = useChannelsStore((s) => s.channels);
  const spaceChannels = channels.filter((c) => c.spaceId === spaceId);
  const cfg = rule.config || {};

  const setType = (type: ConditionType) => onChange({ ...rule, type, config: {} });
  const setCfg = (updates: Record<string, any>) =>
    onChange({ ...rule, config: { ...cfg, ...updates } });

  return (
    <div style={styles.ruleRow}>
      <select
        value={rule.type}
        onChange={(e) => setType(e.target.value as ConditionType)}
        style={styles.ruleTypeSelect}
      >
        {CONDITION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div style={styles.ruleConfig}>
        {rule.type === 'user_has_role' && (
          <select
            value={cfg.roleId || ''}
            onChange={(e) => setCfg({ roleId: e.target.value })}
            style={styles.configSelect}
          >
            <option value="">Select role...</option>
            {roles
              .filter((r) => !r.isSystem)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        )}

        {rule.type === 'channel_is' && (
          <select
            value={cfg.channelId || ''}
            onChange={(e) => setCfg({ channelId: e.target.value })}
            style={styles.configSelect}
          >
            <option value="">Select channel...</option>
            {spaceChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
        )}

        {(rule.type === 'message_contains' ||
          rule.type === 'message_equals' ||
          rule.type === 'invite_code_is') && (
          <input
            type="text"
            value={cfg.value || ''}
            onChange={(e) => setCfg({ value: e.target.value })}
            placeholder={
              rule.type === 'invite_code_is'
                ? 'Invite code...'
                : rule.type === 'message_contains'
                ? 'Text to search for...'
                : 'Exact message text...'
            }
            style={styles.configInput}
          />
        )}

        {rule.type === 'command_arg_equals' && (
          <>
            <input
              type="text"
              value={cfg.argName || ''}
              onChange={(e) => setCfg({ argName: e.target.value })}
              placeholder="Arg name"
              style={{ ...styles.configInput, width: 110 }}
            />
            <input
              type="text"
              value={cfg.value || ''}
              onChange={(e) => setCfg({ value: e.target.value })}
              placeholder="Value"
              style={styles.configInput}
            />
          </>
        )}

        {rule.type === 'button_is' && (
          <input
            type="text"
            value={cfg.buttonId || ''}
            onChange={(e) => setCfg({ buttonId: e.target.value })}
            placeholder="Button ID (e.g. approve, deny)"
            style={styles.configInput}
          />
        )}

        {(rule.type === 'card_field_equals' || rule.type === 'card_field_not_null') && (
          <>
            <input
              type="text"
              value={cfg.fieldKey || ''}
              onChange={(e) => setCfg({ fieldKey: e.target.value })}
              placeholder="Field key"
              style={{ ...styles.configInput, width: 120 }}
            />
            {rule.type === 'card_field_equals' && (
              <input
                type="text"
                value={cfg.value || ''}
                onChange={(e) => setCfg({ value: e.target.value })}
                placeholder="Expected value"
                style={styles.configInput}
              />
            )}
          </>
        )}

        {rule.type === 'webhook_payload_equals' && (
          <>
            <input
              type="text"
              value={cfg.key || ''}
              onChange={(e) => setCfg({ key: e.target.value })}
              placeholder="Payload key (dot-notation, e.g. action)"
              style={{ ...styles.configInput, width: 180 }}
            />
            <input
              type="text"
              value={cfg.value || ''}
              onChange={(e) => setCfg({ value: e.target.value })}
              placeholder="Expected value"
              style={styles.configInput}
            />
          </>
        )}
      </div>

      <label style={styles.negateLabel}>
        <input
          type="checkbox"
          checked={rule.negate || false}
          onChange={(e) => onChange({ ...rule, negate: e.target.checked })}
          style={{ marginRight: 4 }}
        />
        NOT
      </label>

      <button onClick={onRemove} style={styles.removeBtn} title="Remove condition">
        ×
      </button>
    </div>
  );
}

interface GroupEditorProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  onRemove?: () => void;
  depth: number;
  roles: Role[];
  spaceId: string;
}

function GroupEditor({ group, onChange, onRemove, depth, roles, spaceId }: GroupEditorProps) {
  const updateRule = (index: number, item: ConditionRule | ConditionGroup) => {
    const next = [...group.rules];
    next[index] = item;
    onChange({ ...group, rules: next });
  };

  const removeRule = (index: number) => {
    onChange({ ...group, rules: group.rules.filter((_, i) => i !== index) });
  };

  const addRule = () => {
    onChange({ ...group, rules: [...group.rules, defaultRule()] });
  };

  const addSubGroup = () => {
    onChange({ ...group, rules: [...group.rules, defaultGroup()] });
  };

  const toggleOperator = () => {
    onChange({ ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' });
  };

  return (
    <div
      style={{
        ...styles.groupContainer,
        borderLeftColor: depth === 0 ? 'var(--accent)' : 'var(--text-muted)',
        marginLeft: depth > 0 ? 16 : 0,
      }}
    >
      <div style={styles.groupHeader}>
        <button onClick={toggleOperator} style={styles.operatorBtn}>
          {group.operator}
        </button>
        <span style={styles.groupLabel}>
          {depth === 0 ? 'All of these' : 'Subgroup'}
        </span>
        {onRemove && (
          <button onClick={onRemove} style={{ ...styles.removeBtn, marginLeft: 'auto' }}>
            Remove group
          </button>
        )}
      </div>

      <div style={styles.ruleList}>
        {group.rules.map((item, idx) =>
          isGroup(item) ? (
            <GroupEditor
              key={idx}
              group={item}
              onChange={(g) => updateRule(idx, g)}
              onRemove={() => removeRule(idx)}
              depth={depth + 1}
              roles={roles}
              spaceId={spaceId}
            />
          ) : (
            <RuleEditor
              key={idx}
              rule={item}
              onChange={(r) => updateRule(idx, r)}
              onRemove={() => removeRule(idx)}
              roles={roles}
              spaceId={spaceId}
            />
          )
        )}
      </div>

      <div style={styles.groupActions}>
        <button onClick={addRule} style={styles.addBtn}>
          + Add Condition
        </button>
        {depth < 2 && (
          <button onClick={addSubGroup} style={styles.addGroupBtn}>
            + Add Group
          </button>
        )}
      </div>
    </div>
  );
}

export function ConditionBuilder({ conditions, onChange, spaceId }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [enabled, setEnabled] = useState(conditions !== null);

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`)
      .then(setRoles)
      .catch(() => {});
  }, [spaceId]);

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      onChange(null);
    } else {
      const group = defaultGroup();
      setEnabled(true);
      onChange(group);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.toggleRow}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            style={{ marginRight: 6 }}
          />
          Enable Conditions
        </label>
        {enabled && (
          <span style={styles.hint}>Workflow only runs when all conditions match.</span>
        )}
      </div>

      {enabled && conditions && (
        <GroupEditor
          group={conditions}
          onChange={onChange}
          depth={0}
          roles={roles}
          spaceId={spaceId}
        />
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
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  hint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  groupContainer: {
    borderLeft: '2px solid var(--accent)',
    paddingLeft: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  groupLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  operatorBtn: {
    padding: '3px 10px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  ruleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '6px 8px',
  },
  ruleTypeSelect: {
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.83rem',
    flexShrink: 0,
  },
  ruleConfig: {
    display: 'flex',
    gap: 6,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  configSelect: {
    flex: 1,
    minWidth: 120,
    padding: '4px 8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.83rem',
  },
  configInput: {
    flex: 1,
    minWidth: 120,
    padding: '4px 8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.83rem',
  },
  negateLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  removeBtn: {
    padding: '3px 7px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  groupActions: {
    display: 'flex',
    gap: 8,
  },
  addBtn: {
    padding: '5px 10px',
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  addGroupBtn: {
    padding: '5px 10px',
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
};
