import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';

export function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, username, displayName || username, password);
      navigate(redirect ? `/verify-email?redirect=${encodeURIComponent(redirect)}` : '/verify-email');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <img src="/favicon.svg" alt="crab.ac" style={styles.logo} />
        <h1 style={styles.title}>Create an account</h1>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => {
              const stripped = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
              setUsername(stripped);
            }}
            required
            minLength={2}
            maxLength={32}
            style={styles.input}
            placeholder="letters, numbers, _ and -"
          />
          <span style={styles.hint}>
            {username.length > 0 ? `${username.length}/32` : 'Letters, numbers, underscores, hyphens'}
          </span>
        </label>

        <label style={styles.label}>
          Display Name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            placeholder={username || 'Your display name'}
            style={styles.input}
          />
          <span style={styles.hint}>How others will see you. Defaults to your username.</span>
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={styles.input}
          />
        </label>

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
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
  form: {
    background: 'var(--bg-secondary)',
    padding: '2.5rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '0.5rem',
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
    marginTop: '0.5rem',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #666)',
    fontWeight: 400,
    textTransform: 'none' as const,
    letterSpacing: 'normal',
  },
  footer: {
    textAlign: 'center',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '0.5rem',
  },
};
