import { useState } from 'react';
import { WorkflowList } from '../workflows/WorkflowList.js';
import { CustomCommandManager } from '../workflows/CustomCommandManager.js';
import { CardTemplateManager } from '../workflows/CardTemplateManager.js';
import { ExecutionLog } from '../workflows/ExecutionLog.js';

interface Props {
  spaceId: string;
}

type SubTab = 'workflows' | 'commands' | 'templates' | 'log';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'commands', label: 'Commands' },
  { key: 'templates', label: 'Card Templates' },
  { key: 'log', label: 'Execution Log' },
];

export function WorkflowsTab({ spaceId }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('workflows');

  return (
    <div style={styles.container}>
      <div style={styles.subTabBar}>
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              ...styles.subTabBtn,
              ...(activeSubTab === tab.key ? styles.subTabBtnActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeSubTab === 'workflows' && <WorkflowList spaceId={spaceId} />}
        {activeSubTab === 'commands' && <CustomCommandManager spaceId={spaceId} />}
        {activeSubTab === 'templates' && <CardTemplateManager spaceId={spaceId} />}
        {activeSubTab === 'log' && <ExecutionLog spaceId={spaceId} />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  subTabBar: {
    display: 'flex',
    gap: 2,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 0,
  },
  subTabBtn: {
    padding: '7px 14px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: -1,
    borderRadius: 0,
    transition: 'color 0.15s, border-color 0.15s',
  },
  subTabBtnActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent)',
  },
  content: {
    minHeight: 200,
  },
};
