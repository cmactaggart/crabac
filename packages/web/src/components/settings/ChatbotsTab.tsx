import { useState, useEffect } from 'react';
import { Trash2, Plus, Bot } from 'lucide-react';
import { api } from '../../lib/api.js';

interface Chatbot {
  id: string;
  spaceId: string;
  name: string;
  ragflowChatId: string;
  botUserId: string;
  botUsername: string;
  createdAt: string;
}

interface Props {
  spaceId: string;
}

export function ChatbotsTab({ spaceId }: Props) {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [ragflowChatId, setRagflowChatId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchChatbots = async () => {
    try {
      const data = await api<Chatbot[]>(`/plugins/chatbot/spaces/${spaceId}/chatbots`);
      setChatbots(data);
    } catch {
      // Plugin might not be loaded
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChatbots(); }, [spaceId]);

  const handleCreate = async () => {
    if (!name.trim() || !ragflowChatId.trim()) return;
    setCreating(true);
    try {
      await api(`/plugins/chatbot/spaces/${spaceId}/chatbots`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), ragflowChatId: ragflowChatId.trim() }),
      });
      setName('');
      setRagflowChatId('');
      setShowForm(false);
      fetchChatbots();
    } catch (err) {
      console.error('Failed to create chatbot:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (chatbotId: string) => {
    if (!confirm('Delete this chatbot? The bot user will be removed from the space.')) return;
    try {
      await api(`/plugins/chatbot/spaces/${spaceId}/chatbots/${chatbotId}`, { method: 'DELETE' });
      fetchChatbots();
    } catch (err) {
      console.error('Failed to delete chatbot:', err);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 0 }}>
        Chatbots respond when @mentioned in channels. They use RAGflow to generate answers.
      </p>

      {chatbots.length === 0 && !showForm && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
          No chatbots configured yet.
        </div>
      )}

      {chatbots.map((bot) => (
        <div key={bot.id} style={styles.botCard}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bot size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600 }}>{bot.name}</span>
              <span style={styles.botBadge}>BOT</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              @{bot.botUsername} &middot; Chat ID: <code style={{ fontSize: '0.75rem' }}>{bot.ragflowChatId}</code>
            </div>
          </div>
          <button onClick={() => handleDelete(bot.id)} style={styles.deleteBtn} title="Delete chatbot">
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {showForm ? (
        <div style={styles.form}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bot name (e.g. Trail Bot)"
            style={styles.input}
          />
          <input
            value={ragflowChatId}
            onChange={(e) => setRagflowChatId(e.target.value)}
            placeholder="RAGflow Chat ID"
            style={styles.input}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={creating || !name.trim() || !ragflowChatId.trim()} style={styles.createBtn}>
              {creating ? 'Creating...' : 'Create Chatbot'}
            </button>
            <button onClick={() => { setShowForm(false); setName(''); setRagflowChatId(''); }} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          <Plus size={16} /> Add Chatbot
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  botCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    marginBottom: 8,
    border: '1px solid var(--border)',
  },
  botBadge: {
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 3,
    textTransform: 'uppercase' as const,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 'var(--radius)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    marginTop: 8,
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input, var(--bg-primary))',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  createBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
};
