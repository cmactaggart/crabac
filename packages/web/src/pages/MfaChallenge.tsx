import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api, setTokens } from '../lib/api.js';
import { connectSocket } from '../lib/socket.js';

export function MfaChallenge() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const navigate = useNavigate();

  const mfaToken = sessionStorage.getItem('mfaToken');

  if (!mfaToken) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await api('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ mfaToken, code: code.trim() }),
      });
      sessionStorage.removeItem('mfaToken');
      setTokens(data.accessToken, data.refreshToken);
      useAuthStore.setState({ user: data.user });
      connectSocket();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Two-factor authentication</h1>
        <p style={styles.text}>
          {useBackup
            ? 'Enter one of your backup codes.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={useBackup ? 'xxxx-xxxx' : '000000'}
          autoFocus
          required
          maxLength={useBackup ? 9 : 6}
          style={styles.input}
          autoComplete="one-time-code"
        />

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={() => { setUseBackup(!useBackup); setCode(''); setError(''); }}
          style={styles.link}
        >
          {useBackup ? 'Use authenticator code' : 'Use a backup code'}
        </button>
      </form>
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
    fontSize: '0.875rem',
  },
  input: {
    padding: '0.7rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '1.5rem',
    textAlign: 'center',
    letterSpacing: '0.3em',
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
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: 0,
  },
};
