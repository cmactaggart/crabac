import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../lib/api.js';
import { setTokens } from '../lib/api.js';
import { connectSocket } from '../lib/socket.js';

export function MagicLink() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [redeeming, setRedeeming] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    setRedeeming(true);
    api('/auth/magic-link/redeem', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((data: any) => {
        if (data.mfaRequired) {
          // Store MFA token and redirect
          sessionStorage.setItem('mfaToken', data.mfaToken);
          navigate('/mfa-challenge');
        } else {
          setTokens(data.accessToken, data.refreshToken);
          useAuthStore.setState({ user: data.user });
          connectSocket();
          navigate('/');
        }
      })
      .catch((err: any) => {
        setRedeeming(false);
        setError(err.message || 'Invalid or expired magic link');
      });
  }, [token, navigate]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/magic-link/send', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setSubmitting(false);
    }
  };

  if (redeeming) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Signing you in...</h1>
          <p style={styles.text}>Please wait.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Magic link sign in</h1>

        {error && <div style={styles.error}>{error}</div>}

        {sent ? (
          <>
            <p style={styles.text}>Check your email! We sent a sign-in link to <strong>{email}</strong>.</p>
            <p style={styles.textSmall}>The link expires in 15 minutes.</p>
          </>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={styles.label}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" disabled={submitting} style={styles.button}>
              {submitting ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}

        <Link to="/login" style={styles.link}>Back to login</Link>
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
  textSmall: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    textAlign: 'left',
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
  button: {
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  link: {
    color: 'var(--accent)',
    fontSize: '0.875rem',
  },
};
