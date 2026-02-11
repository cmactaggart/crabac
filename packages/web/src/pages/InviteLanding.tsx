import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../lib/api.js';

export function InviteLanding() {
  const { code } = useParams<{ code: string }>();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [spaceName, setSpaceName] = useState<string | null>(null);

  // Try to preview the invite
  useEffect(() => {
    if (!code) return;
    api(`/spaces/invites/${code}/preview`)
      .then((data: any) => setSpaceName(data.spaceName))
      .catch(() => {}); // preview is optional
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    setError('');
    setJoining(true);
    try {
      const space = await api<any>('/spaces/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      navigate(`/space/${space.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          {spaceName ? `You've been invited to ${spaceName}` : "You've been invited!"}
        </h1>

        {error && <div style={styles.error}>{error}</div>}

        {user ? (
          <>
            <p style={styles.text}>
              Signed in as <strong>{user.displayName}</strong>
            </p>
            <button onClick={handleJoin} disabled={joining} style={styles.button}>
              {joining ? 'Joining...' : 'Accept Invite'}
            </button>
          </>
        ) : (
          <>
            <p style={styles.text}>Sign in or create an account to join this space.</p>
            <Link to={`/login?redirect=/invite/${code}`} onClick={() => sessionStorage.setItem('pendingInviteCode', code!)} style={styles.button}>
              Sign In
            </Link>
            <Link to={`/register?redirect=/invite/${code}`} onClick={() => sessionStorage.setItem('pendingInviteCode', code!)} style={styles.linkBtn}>
              Create an account
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'var(--bg-primary)',
  },
  card: {
    background: 'var(--bg-secondary)',
    padding: '2.5rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
  },
  text: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
  },
  button: {
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    textAlign: 'center',
  },
  linkBtn: {
    color: 'var(--accent)',
    fontSize: '0.875rem',
    textDecoration: 'none',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
};
