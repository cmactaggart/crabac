import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';

type Tab = 'spaces' | 'users' | 'announcements' | 'tags';

interface AdminSpace {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface PredefinedTag {
  id: string;
  name: string;
  slug: string;
}

interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  status: string;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function AdminPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('announcements');

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <button onClick={() => navigate('/')} style={styles.backBtn}>
            <ArrowLeft size={18} /> Back
          </button>
          <h1 style={styles.title}>Admin Panel</h1>
        </div>

        <div style={styles.tabs}>
          {(['announcements', 'spaces', 'users', 'tags'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'spaces' && <SpacesTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'tags' && <TagsTab />}
      </div>
    </div>
  );
}

function SpacesTab() {
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpaces = () => {
    api<AdminSpace[]>('/admin/spaces').then(setSpaces).finally(() => setLoading(false));
  };

  useEffect(() => { fetchSpaces(); }, []);

  const toggleFeatured = async (spaceId: string) => {
    try {
      await api(`/admin/spaces/${spaceId}/feature`, { method: 'POST' });
      fetchSpaces();
    } catch {
      // ignore
    }
  };

  if (loading) return <p style={styles.muted}>Loading...</p>;

  return (
    <div>
      <p style={styles.muted}>{spaces.length} space{spaces.length !== 1 ? 's' : ''}</p>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Slug</th>
            <th style={styles.th}>Members</th>
            <th style={styles.th}>Public</th>
            <th style={styles.th}>Featured</th>
            <th style={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {spaces.map((s) => (
            <tr key={s.id}>
              <td style={styles.td}>{s.name}</td>
              <td style={styles.td}>{s.slug}</td>
              <td style={styles.td}>{s.memberCount}</td>
              <td style={styles.td}>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: s.isPublic ? 'rgba(87, 242, 135, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: s.isPublic ? '#57f287' : 'var(--text-muted)',
                }}>
                  {s.isPublic ? 'Yes' : 'No'}
                </span>
              </td>
              <td style={styles.td}>
                {s.isPublic && (
                  <button
                    onClick={() => toggleFeatured(s.id)}
                    style={{
                      ...styles.smallBtn,
                      color: s.isFeatured ? '#faa61a' : 'var(--text-secondary)',
                    }}
                  >
                    {s.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>
                )}
              </td>
              <td style={styles.td}>{new Date(s.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminUser[]>('/admin/users').then(setUsers).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={styles.muted}>Loading...</p>;

  return (
    <div>
      <p style={styles.muted}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={styles.td}>{u.username}</td>
              <td style={styles.td}>{u.email}</td>
              <td style={styles.td}>{u.status}</td>
              <td style={styles.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState('');

  const fetchAnnouncements = () => {
    api<Announcement[]>('/admin/announcements').then(setAnnouncements).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
      setTitle('');
      setContent('');
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggle = async (a: Announcement) => {
    await api(`/admin/announcements/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !a.active }),
    });
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await api(`/admin/announcements/${id}`, { method: 'DELETE' });
    fetchAnnouncements();
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditContent(a.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await api(`/admin/announcements/${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    setEditingId(null);
    fetchAnnouncements();
  };

  if (loading) return <p style={styles.muted}>Loading...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Create form */}
      <form onSubmit={handleCreate} style={styles.createForm}>
        <h3 style={{ margin: 0, fontSize: '0.9rem' }}>New Announcement</h3>
        {error && <div style={styles.error}>{error}</div>}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          style={styles.input}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Content"
          required
          rows={3}
          style={{ ...styles.input, resize: 'vertical' }}
        />
        <button type="submit" style={styles.primaryBtn}>Create</button>
      </form>

      {/* List */}
      {announcements.length === 0 ? (
        <p style={styles.muted}>No announcements yet.</p>
      ) : (
        announcements.map((a) => (
          <div key={a.id} style={styles.announcementItem}>
            {editingId === a.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={styles.input}
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  style={{ ...styles.input, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleSaveEdit} style={styles.smallBtn}>Save</button>
                  <button onClick={() => setEditingId(null)} style={styles.smallBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <strong>{a.title}</strong>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: a.active ? 'rgba(87, 242, 135, 0.2)' : 'rgba(255,255,255,0.1)',
                      color: a.active ? '#57f287' : 'var(--text-secondary)',
                    }}>
                      {a.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {a.content.length > 120 ? a.content.slice(0, 120) + '...' : a.content}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button onClick={() => handleToggle(a)} style={styles.smallBtn}>
                    {a.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => startEdit(a)} style={styles.smallBtn}>Edit</button>
                  <button onClick={() => handleDelete(a.id)} style={{ ...styles.smallBtn, color: 'var(--danger)' }}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function TagsTab() {
  const [tags, setTags] = useState<PredefinedTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const fetchTags = () => {
    api<PredefinedTag[]>('/admin/tags').then(setTags).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTags(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/tags', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      fetchTags();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    await api(`/admin/tags/${id}`, { method: 'DELETE' });
    fetchTags();
  };

  if (loading) return <p style={styles.muted}>Loading...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <form onSubmit={handleCreate} style={styles.createForm}>
        <h3 style={{ margin: 0, fontSize: '0.9rem' }}>New Predefined Tag</h3>
        {error && <div style={styles.error}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name"
            required
            maxLength={50}
            style={{ ...styles.input, flex: 1 }}
          />
          <button type="submit" style={styles.primaryBtn}>Create</button>
        </div>
      </form>

      <p style={styles.muted}>{tags.length} predefined tag{tags.length !== 1 ? 's' : ''}</p>
      {tags.length === 0 ? (
        <p style={styles.muted}>No predefined tags yet.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Slug</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.id}>
                <td style={styles.td}>{t.name}</td>
                <td style={styles.td}>{t.slug}</td>
                <td style={styles.td}>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ ...styles.smallBtn, color: 'var(--danger)' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '3rem 2rem',
  },
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '2rem',
    width: '100%',
    maxWidth: '700px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  title: { fontSize: '1.5rem', fontWeight: 800 },
  tabs: {
    display: 'flex',
    gap: '0.25rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '0',
  },
  tab: {
    padding: '0.5rem 1rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent)',
  },
  muted: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
  },
  td: {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    background: 'var(--bg-input)',
    padding: '1rem',
    borderRadius: 'var(--radius)',
  },
  input: {
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-tertiary, var(--bg-secondary))',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  primaryBtn: {
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  smallBtn: {
    padding: '0.3rem 0.6rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  announcementItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.5rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
};
