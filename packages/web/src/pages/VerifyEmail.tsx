import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'joining' | 'joined' | 'error' | 'idle'>(token ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [joinedSpaceName, setJoinedSpaceName] = useState('');
  const [joinedSpaceId, setJoinedSpaceId] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;
    api('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async () => {
        // Check for pending invite
        const inviteCode = sessionStorage.getItem('pendingInviteCode');
        if (inviteCode) {
          setStatus('joining');
          sessionStorage.removeItem('pendingInviteCode');
          try {
            const space = await api<any>('/spaces/join', {
              method: 'POST',
              body: JSON.stringify({ code: inviteCode }),
            });
            setJoinedSpaceName(space.name);
            setJoinedSpaceId(space.id);
            setStatus('joined');
          } catch {
            // Join failed (expired, etc.) — still show verification success
            setStatus('success');
          }
        } else {
          setStatus('success');
        }
      })
      .catch((err: any) => {
        setStatus('error');
        setError(err.message || 'Verification failed');
      });
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      setResent(true);
    } catch (err: any) {
      setError(err.message || 'Could not resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <h1 style={styles.title}>Verifying your email...</h1>
            <p style={styles.text}>Please wait.</p>
          </>
        )}

        {status === 'joining' && (
          <>
            <h1 style={styles.title}>Email verified! Joining space...</h1>
            <p style={styles.text}>Please wait.</p>
          </>
        )}

        {status === 'joined' && (
          <>
            <h1 style={styles.title}>You're in!</h1>
            <p style={styles.text}>Email verified and you've joined <strong>{joinedSpaceName}</strong>.</p>
            <Link to={`/space/${joinedSpaceId}`} style={styles.button}>Go to {joinedSpaceName}</Link>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={styles.title}>Email verified!</h1>
            <p style={styles.text}>Your email has been verified. You can now sign in.</p>
            <Link to="/login" style={styles.button}>Sign In</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 style={styles.title}>Verification failed</h1>
            <p style={styles.error}>{error}</p>
            <Link to="/login" style={styles.link}>Back to login</Link>
          </>
        )}

        {status === 'idle' && (
          <>
            <h1 style={styles.title}>Check your email</h1>
            <p style={styles.text}>
              We sent you a verification link. Click the link in the email to verify your account.
            </p>
            {resent ? (
              <p style={styles.success}>Verification email resent! Check your inbox.</p>
            ) : (
              <button onClick={handleResend} disabled={resending} style={styles.button}>
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            )}
            <Link to="/login" style={styles.link}>Back to login</Link>
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
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  text: {
    color: 'var(--text-secondary)',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  success: {
    color: '#43b581',
    fontSize: '0.875rem',
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
  link: {
    color: 'var(--accent)',
    fontSize: '0.875rem',
  },
};
