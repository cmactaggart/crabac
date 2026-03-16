import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reset your password</h1>

        {error && <div style={styles.error}>{error}</div>}

        {sent ? (
          <>
            <p style={styles.text}>
              If an account exists for <strong>{email}</strong>, we sent a password reset link.
            </p>
            <p style={styles.textSmall}>The link expires in 1 hour.</p>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={styles.textSmall}>Enter your email and we'll send you a link to reset your password.</p>
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
              {submitting ? 'Sending...' : 'Send reset link'}
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
