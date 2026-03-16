import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Invalid reset link</h1>
          <p style={styles.text}>This link is missing a reset token.</p>
          <Link to="/forgot-password" style={styles.link}>Request a new reset link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Password reset!</h1>
          <p style={styles.text}>Your password has been updated. You can now sign in with your new password.</p>
          <Link to="/login" style={styles.buttonLink}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Set new password</h1>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={styles.label}>
            New Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={styles.input}
              placeholder="At least 8 characters"
            />
          </label>
          <label style={styles.label}>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={styles.input}
              placeholder="Repeat your password"
            />
          </label>
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

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
  buttonLink: {
    display: 'inline-block',
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 600,
    textDecoration: 'none',
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
