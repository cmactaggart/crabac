import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBoardAuthStore } from '../../stores/boardAuth.js';

export function BoardLogin() {
  const { spaceSlug } = useParams();
  const navigate = useNavigate();
  const login = useBoardAuthStore((s) => s.login);
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(loginValue, password);
      navigate(`/boards/${spaceSlug}`);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Board Login</h2>
      <p style={styles.text}>Log in to participate in discussions.</p>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Email or Username</label>
          <input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            required
            style={styles.input}
            autoFocus
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <button type="submit" disabled={loading} style={styles.submitBtn}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p style={styles.footer}>
        Don't have an account?{' '}
        <Link to={`/boards/${spaceSlug}/register`} style={styles.link}>Register</Link>
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    maxWidth: 400,
    margin: '40px auto',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '24px 32px',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '1.2rem',
    color: '#2d3748',
  },
  text: {
    margin: '0 0 16px',
    color: '#666',
    fontSize: '0.85rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#4a5568',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: '0.9rem',
    outline: 'none',
  },
  submitBtn: {
    padding: '10px',
    background: '#e2a33e',
    border: 'none',
    color: '#fff',
    borderRadius: 4,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  error: {
    background: '#fff5f5',
    color: '#c53030',
    padding: '8px 12px',
    borderRadius: 4,
    fontSize: '0.85rem',
    marginBottom: 12,
    border: '1px solid #feb2b2',
  },
  footer: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: '0.85rem',
    color: '#666',
  },
  link: {
    color: '#2b6cb0',
    textDecoration: 'none',
  },
};
