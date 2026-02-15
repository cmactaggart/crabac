import { Outlet, Link, useParams } from 'react-router-dom';

export function GalleryLayout() {
  const { spaceSlug } = useParams();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link to={`/gallery/${spaceSlug}`} style={styles.logo}>
            Gallery
          </Link>
          <nav style={styles.nav}>
            <Link to="/login" style={styles.authBtn}>Log in to app</Link>
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
    background: '#fafafa',
    color: '#333',
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 16px',
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  logo: {
    color: '#111',
    fontSize: '1.15rem',
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  authBtn: {
    color: '#666',
    fontSize: '0.8rem',
    textDecoration: 'none',
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid #ddd',
    background: 'none',
  },
  main: {
    flex: 1,
    maxWidth: 1100,
    margin: '0 auto',
    width: '100%',
    padding: '24px 16px',
  },
  footer: {
    textAlign: 'center',
    padding: '16px',
    fontSize: '0.75rem',
    color: '#999',
    borderTop: '1px solid #e5e7eb',
  },
};
