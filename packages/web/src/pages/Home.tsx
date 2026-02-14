import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { MfaSetup, MfaDisable } from './MfaSetup.js';
import { Markdown } from '../components/common/Markdown.js';
import { PublicSpaceDirectory } from '../components/spaces/PublicSpaceDirectory.js';
import { SpaceBrandedCard } from '../components/spaces/SpaceBrandedCard.js';
import { api } from '../lib/api.js';

interface Announcement {
  id: string;
  title: string;
  content: string;
  active: boolean;
  createdAt: string;
}

export function Home() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { spaces, fetchSpaces } = useSpacesStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unseenAnnouncements, setUnseenAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    api<Announcement[]>('/announcements/active').then(setAnnouncements).catch(() => {});
    api<Announcement[]>('/announcements/unseen').then((data) => {
      setUnseenAnnouncements(data);
      if (data.length > 0) {
        setShowAnnouncementModal(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <div style={{
      ...styles.container,
      padding: isMobile ? '1rem' : '3rem 2rem',
      paddingBottom: isMobile ? 72 : undefined,
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      {/* Left Card — Your Spaces */}
      <div style={{
        ...styles.card,
        maxWidth: isMobile ? '100%' : '460px',
      }}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>crab.ac</h1>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              <a href="https://github.com/cmactaggart/crabac" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>GitHub</a>
              <a href="https://bsky.app/profile/crabac.bsky.social" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>Bluesky</a>
              <a href="mailto:bingo@crab.ac" style={{ color: 'var(--text-muted)' }}>bingo@crab.ac</a>
            </div>
          </div>
          <div style={styles.userInfo}>
            {user?.isAdmin && (
              <button onClick={() => navigate('/admin')} style={styles.adminBtn}>Admin</button>
            )}
            <button
              onClick={() => setShowAccount(true)}
              style={styles.usernameBtn}
            >
              {user?.displayName}
            </button>
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <section>
            <h2 style={styles.sectionTitle}>Announcements</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {announcements.map((a) => (
                <div key={a.id} style={styles.announcementCard}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {formatDate(a.createdAt)}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{a.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Markdown content={a.content} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Your Spaces */}
        <section>
          <h2 style={styles.sectionTitle}>Your Spaces</h2>
          {spaces.length === 0 ? (
            <p style={styles.muted}>You haven't joined any spaces yet.</p>
          ) : (
            <div style={styles.spaceList}>
              {spaces.map((space) => (
                <SpaceBrandedCard
                  key={space.id}
                  name={space.name}
                  description={space.description || space.slug}
                  iconUrl={space.iconUrl}
                  baseColor={space.baseColor}
                  accentColor={space.accentColor}
                  textColor={space.textColor}
                  onClick={() => navigate(`/space/${space.id}`)}
                />
              ))}
            </div>
          )}
          <div style={styles.actions}>
            <button onClick={() => setShowCreate(true)} style={styles.primaryBtn}>
              Create a Space
            </button>
            <button onClick={() => setShowJoin(true)} style={styles.secondaryBtn}>
              Join with Invite
            </button>
          </div>
        </section>
      </div>

      {/* Right Card — Discover Spaces */}
      <div style={{
        ...styles.rightCard,
        maxWidth: isMobile ? '100%' : '460px',
      }}>
        <h2 style={{ ...styles.sectionTitle, color: '#5a3a3a' }}>Discover Spaces</h2>
        <PublicSpaceDirectory lightTheme />
      </div>

      {showCreate && <CreateSpaceModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinSpaceModal onClose={() => setShowJoin(false)} />}
      {showMfa && <MfaModal user={user} onClose={() => { setShowMfa(false); }} />}
      {showAccount && (
        <AccountModal
          user={user}
          onClose={() => setShowAccount(false)}
          onMfa={() => { setShowAccount(false); setShowMfa(true); }}
          onLogout={logout}
        />
      )}
      {showAnnouncementModal && unseenAnnouncements.length > 0 && (
        <AnnouncementModal
          announcements={unseenAnnouncements}
          onDismiss={async () => {
            const maxId = unseenAnnouncements.reduce(
              (max, a) => (a.id > max ? a.id : max),
              unseenAnnouncements[0].id,
            );
            try {
              await api('/announcements/dismiss', {
                method: 'POST',
                body: JSON.stringify({ lastSeenId: maxId }),
              });
            } catch {}
            setShowAnnouncementModal(false);
            setUnseenAnnouncements([]);
          }}
        />
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function truncateContent(content: string, maxLen = 150): { text: string; truncated: boolean } {
  if (content.length <= maxLen) return { text: content, truncated: false };
  return { text: content.slice(0, maxLen).trimEnd() + '...', truncated: true };
}

function AccountModal({ user, onClose, onMfa, onLogout }: { user: any; onClose: () => void; onMfa: () => void; onLogout: () => void }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        <h2 style={{ margin: '0 0 0.5rem' }}>Account & Security</h2>

        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.displayName}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{user?.username}</div>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.email}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user?.emailVerified ? 'Verified' : 'Not verified'}
            </div>
          </div>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={{ fontWeight: 600 }}>Two-Factor Authentication</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {user?.totpEnabled ? 'Enabled' : 'Not enabled'}
            </div>
          </div>
          <button onClick={onMfa} style={styles.smallBtn}>
            {user?.totpEnabled ? 'Manage' : 'Set up'}
          </button>
        </div>

        <button onClick={onLogout} style={{ ...styles.secondaryBtn, marginTop: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

function AnnouncementModal({ announcements, onDismiss }: { announcements: Announcement[]; onDismiss: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? announcements.find((a) => a.id === detailId) : null;

  return (
    <div style={styles.overlay} onClick={onDismiss}>
      <div onClick={(e) => e.stopPropagation()} style={announcementStyles.modal}>
        {/* Header */}
        <div style={announcementStyles.header}>
          {detail ? (
            <button onClick={() => setDetailId(null)} style={announcementStyles.backBtn}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          ) : (
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>What's New</h2>
          )}
        </div>

        {/* Body */}
        <div style={announcementStyles.body}>
          {detail ? (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {formatDate(detail.createdAt)}
              </div>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>{detail.title}</h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <Markdown content={detail.content} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {announcements.map((a) => {
                const { text, truncated } = truncateContent(a.content);
                return (
                  <div
                    key={a.id}
                    style={announcementStyles.card}
                    onClick={() => setDetailId(a.id)}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      {formatDate(a.createdAt)}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{a.title}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {text}
                    </div>
                    {truncated && (
                      <span style={announcementStyles.readMore}>Read More &gt;</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={announcementStyles.footer}>
          <button onClick={onDismiss} style={styles.primaryBtn}>
            Dismiss All
          </button>
        </div>
      </div>
    </div>
  );
}

const announcementStyles: Record<string, React.CSSProperties> = {
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.5rem',
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  card: {
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    borderLeft: '3px solid var(--accent)',
    cursor: 'pointer',
  },
  readMore: {
    color: 'var(--accent)',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginTop: '0.25rem',
    display: 'inline-block',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
};

function MfaModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [done, setDone] = useState(false);

  const handleComplete = () => {
    setDone(true);
    api('/users/me').then((u) => useAuthStore.setState({ user: u }));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={styles.modal}>
        {user?.totpEnabled ? (
          done ? (
            <div style={{ textAlign: 'center' }}>
              <h3>MFA Disabled</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Two-factor authentication has been removed.</p>
              <button onClick={onClose} style={styles.primaryBtn}>Close</button>
            </div>
          ) : (
            <MfaDisable onComplete={handleComplete} />
          )
        ) : (
          <MfaSetup onComplete={handleComplete} />
        )}
        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
      </div>
    </div>
  );
}

function CreateSpaceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const createSpace = useSpacesStore((s) => s.createSpace);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const space = await createSpace(name, slug);
      navigate(`/space/${space.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={styles.modal}>
        <h2>Create a Space</h2>
        {error && <div style={styles.error}>{error}</div>}
        <label style={styles.label}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required style={styles.input} />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
          <button type="submit" style={styles.primaryBtn}>Create</button>
        </div>
      </form>
    </div>
  );
}

function JoinSpaceModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const fetchSpaces = useSpacesStore((s) => s.fetchSpaces);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api<any>('/spaces/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      await fetchSpaces();
      navigate(`/space/${res.id}`);
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={styles.modal}>
        <h2>Join a Space</h2>
        {error && <div style={styles.error}>{error}</div>}
        <label style={styles.label}>
          Invite Code
          <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="Paste an invite link or code" style={styles.input} />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
          <button type="submit" style={styles.primaryBtn}>Join</button>
        </div>
      </form>
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
    gap: '1.5rem',
  },
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '2rem',
    width: '100%',
    maxWidth: '460px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  rightCard: {
    background: '#f5f0ef',
    borderRadius: 'var(--radius)',
    padding: '2rem',
    width: '100%',
    maxWidth: '460px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    color: '#2e1a1a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: '1.5rem', fontWeight: 800 },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  usernameBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  adminBtn: {
    background: 'none',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  announcementCard: {
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    borderLeft: '3px solid var(--accent)',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  muted: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  spaceList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.75rem',
  },
  settingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    marginBottom: '0.5rem',
  },
  smallBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  primaryBtn: {
    flex: 1,
    padding: '0.65rem 1rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '0.65rem 1rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-secondary)',
    padding: '2rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  input: {
    padding: '0.7rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
