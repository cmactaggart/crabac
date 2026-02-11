import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';

export function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const doLogin = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setSubmitting(true);
    try {
      const result = await doLogin(login, password);
      if (result?.mfaRequired) {
        sessionStorage.setItem('mfaToken', result.mfaToken);
        navigate('/mfa-challenge');
      } else {
        navigate(redirect || '/');
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      if (msg.includes('not verified')) {
        setUnverified(true);
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <img src="/favicon.svg" alt="crab.ac" style={styles.logo} />
        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.subtitle}>Sign in to your crab.ac account</p>

        {error && (
          <div style={styles.error}>
            {error}
            {unverified && (
              <div style={{ marginTop: '0.5rem' }}>
                <Link to="/verify-email" style={{ color: 'var(--accent)' }}>Resend verification email</Link>
              </div>
            )}
          </div>
        )}

        <label style={styles.label}>
          Email or Username
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            style={styles.input}
            placeholder="you@example.com or username"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
            placeholder="Your password"
          />
        </label>

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        <Link to="/auth/magic" style={styles.magicLink}>Sign in with magic link</Link>

        <p style={styles.footer}>
          Don't have an account? <Link to="/register">Register</Link>
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
  },
  subtitle: {
    color: 'var(--text-secondary)',
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
  magicLink: {
    textAlign: 'center',
    color: 'var(--accent)',
    fontSize: '0.875rem',
  },
  footer: {
    textAlign: 'center',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '0.5rem',
  },
};
