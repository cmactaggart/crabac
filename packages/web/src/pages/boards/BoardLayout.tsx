import { Outlet, Link, useParams } from 'react-router-dom';
import { useBoardAuthStore } from '../../stores/boardAuth.js';

export function BoardLayout() {
  const { spaceSlug } = useParams();
  const { user, logout } = useBoardAuthStore();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to={`/boards/${spaceSlug}`} style={styles.logo}>
            Message Board
          </Link>
          <nav style={styles.nav}>
            {user ? (
              <div style={styles.userInfo}>
                <span style={styles.username}>{user.displayName}</span>
                <button onClick={logout} style={styles.authBtn}>Log out</button>
              </div>
            ) : (
              <div style={styles.authLinks}>
                <Link to={`/boards/${spaceSlug}/login`} style={styles.authBtn}>Log in</Link>
                <Link to={`/boards/${spaceSlug}/register`} style={styles.registerBtn}>Register</Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main style={styles.main}>
        <Outlet />
      </main>

      <footer style={styles.footer}>
        <span>Powered by crab.ac</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f4f0e8',
    color: '#333',
    fontFamily: '"Trebuchet MS", "Lucida Sans", Arial, sans-serif',
  },
  header: {
    background: 'linear-gradient(180deg, #4a5568 0%, #2d3748 100%)',
    borderBottom: '3px solid #e2a33e',
    padding: '0 16px',
  },
  headerInner: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  logo: {
    color: '#fff',
    fontSize: '1.2rem',
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  username: {
    color: '#e2a33e',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  authLinks: {
    display: 'flex',
    gap: 8,
  },
  authBtn: {
    color: '#ccc',
    fontSize: '0.8rem',
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'none',
    cursor: 'pointer',
  },
  registerBtn: {
    color: '#fff',
    fontSize: '0.8rem',
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 4,
    background: '#e2a33e',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    maxWidth: 960,
    margin: '0 auto',
    width: '100%',
    padding: '20px 16px',
  },
  footer: {
    textAlign: 'center',
    padding: '16px',
    fontSize: '0.75rem',
    color: '#999',
    borderTop: '1px solid #ddd',
  },
};
