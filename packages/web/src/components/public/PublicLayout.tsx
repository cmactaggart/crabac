import { useEffect, useState } from 'react';
import { Outlet, Link, useParams, useLocation } from 'react-router-dom';
import { useBoardAuthStore } from '../../stores/boardAuth.js';
import { PublicThemeProvider } from '../../contexts/PublicThemeContext.js';
import { getPublicTheme, type PublicTheme } from '../../lib/publicThemes.js';
import { boardApi } from '../../lib/boardApi.js';

type PageType = 'boards' | 'gallery' | 'routes' | 'calendar' | 'blog' | 'newsletter';

const PAGE_LABELS: Record<PageType, string> = {
  boards: 'Message Board',
  gallery: 'Gallery',
  routes: 'Routes',
  calendar: 'Calendar',
  blog: 'Blog',
  newsletter: 'Newsletter',
};

const PAGE_PREFIXES: Record<PageType, string> = {
  boards: '/boards',
  gallery: '/gallery',
  routes: '/routes',
  calendar: '/calendar',
  blog: '/blog',
  newsletter: '/newsletter',
};

const FEATURE_LABELS: Record<string, string> = {
  boards: 'Boards',
  gallery: 'Gallery',
  routes: 'Routes',
  calendar: 'Calendar',
  blog: 'Blog',
  newsletter: 'Newsletter',
};

interface NavLink {
  label: string;
  url: string;
}

interface Props {
  pageType: PageType;
}

export function PublicLayout({ pageType }: Props) {
  const { spaceSlug } = useParams();
  const location = useLocation();
  const [theme, setTheme] = useState<PublicTheme>(getPublicTheme(null));
  const [navFeatures, setNavFeatures] = useState<string[]>([]);
  const [navLinks, setNavLinks] = useState<NavLink[]>([]);

  // Fetch site config (theme + features + nav links) on mount
  useEffect(() => {
    if (!spaceSlug) return;
    boardApi<{
      space: { publicTheme?: string | null };
      navFeatures: string[];
      navLinks: NavLink[];
    }>(`/site-config/${spaceSlug}`)
      .then((data) => {
        setTheme(getPublicTheme(data.space?.publicTheme));
        setNavFeatures(data.navFeatures || []);
        setNavLinks(data.navLinks || []);
      })
      .catch(() => {
        // Fallback: try the old board API for theme
        boardApi<{ space: { publicTheme?: string | null } }>(`/${spaceSlug}`)
          .then((data) => {
            setTheme(getPublicTheme(data.space?.publicTheme));
          })
          .catch(() => {});
      });
  }, [spaceSlug]);

  const maxWidth = (pageType === 'blog' || pageType === 'newsletter') ? 800 : theme.layout.maxWidth;
  const c = theme.colors;

  const showNavbar = navFeatures.length > 1 || navLinks.length > 0;

  return (
    <PublicThemeProvider value={theme}>
      <div style={{
        minHeight: '100vh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: c.pageBg,
        color: c.pageText,
        fontFamily: c.fontFamily,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        <header style={{
          background: c.headerBg,
          borderBottom: showNavbar ? 'none' : `${c.headerBorderWidth}px solid ${c.headerBorder}`,
          padding: '0 16px',
        }}>
          <div style={{
            maxWidth,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 52,
          }}>
            <Link
              to={`${PAGE_PREFIXES[pageType]}/${spaceSlug}`}
              style={{
                color: c.logoColor,
                fontSize: '1.15rem',
                fontWeight: 700,
                textDecoration: 'none',
                letterSpacing: '-0.02em',
              }}
            >
              {PAGE_LABELS[pageType]}
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {pageType === 'boards' ? (
                <BoardNav spaceSlug={spaceSlug!} colors={c} />
              ) : (
                <Link
                  to="/login"
                  style={{
                    color: c.navBtnColor,
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: `1px solid ${c.navBtnBorder}`,
                    background: 'none',
                  }}
                >
                  Log in to app
                </Link>
              )}
            </nav>
          </div>
        </header>

        {showNavbar && (
          <PublicNavbar
            spaceSlug={spaceSlug!}
            enabledFeatures={navFeatures}
            navLinks={navLinks}
            currentPage={pageType}
            colors={c}
            maxWidth={maxWidth}
            pathname={location.pathname}
          />
        )}

        <main style={{
          flex: 1,
          maxWidth,
          margin: '0 auto',
          width: '100%',
          padding: '24px 16px',
        }}>
          <Outlet />
        </main>

        <footer style={{
          textAlign: 'center',
          padding: '16px',
          fontSize: '0.75rem',
          color: c.footerText,
          borderTop: `1px solid ${c.footerBorder}`,
        }}>
          <span>Powered by crab.ac</span>
        </footer>
      </div>
    </PublicThemeProvider>
  );
}

function PublicNavbar({
  spaceSlug,
  enabledFeatures,
  navLinks,
  currentPage,
  colors: c,
  maxWidth,
  pathname,
}: {
  spaceSlug: string;
  enabledFeatures: string[];
  navLinks: NavLink[];
  currentPage: PageType;
  colors: PublicTheme['colors'];
  maxWidth: number;
  pathname: string;
}) {
  return (
    <nav style={{
      background: c.headerBg,
      borderBottom: `${c.headerBorderWidth}px solid ${c.headerBorder}`,
      padding: '0 16px',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        maxWidth,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        minHeight: 38,
      }}>
        {enabledFeatures.map((feature) => {
          const isActive = feature === currentPage;
          const prefix = PAGE_PREFIXES[feature as PageType];
          const href = `${prefix}/${spaceSlug}`;
          return (
            <Link
              key={feature}
              to={href}
              style={{
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? c.accent : c.secondaryText,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                borderBottom: isActive ? `2px solid ${c.accent}` : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {FEATURE_LABELS[feature] || feature}
            </Link>
          );
        })}

        {navLinks.length > 0 && enabledFeatures.length > 0 && (
          <div style={{
            width: 1,
            height: 18,
            background: c.headerBorder,
            margin: '0 6px',
            flexShrink: 0,
          }} />
        )}

        {navLinks.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 14px',
              fontSize: '0.82rem',
              color: c.secondaryText,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              borderBottom: '2px solid transparent',
            }}
          >
            {link.label}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        ))}
      </div>
    </nav>
  );
}

function BoardNav({ spaceSlug, colors }: { spaceSlug: string; colors: PublicTheme['colors'] }) {
  const { user, logout } = useBoardAuthStore();

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: colors.accent, fontSize: '0.85rem', fontWeight: 600 }}>
          {user.displayName}
        </span>
        <button
          onClick={logout}
          style={{
            color: colors.navBtnColor,
            fontSize: '0.8rem',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: 4,
            border: `1px solid ${colors.navBtnBorder}`,
            background: 'none',
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Link
        to={`/boards/${spaceSlug}/login`}
        style={{
          color: colors.navBtnColor,
          fontSize: '0.8rem',
          textDecoration: 'none',
          padding: '4px 10px',
          borderRadius: 4,
          border: `1px solid ${colors.navBtnBorder}`,
          background: 'none',
        }}
      >
        Log in
      </Link>
      <Link
        to={`/boards/${spaceSlug}/register`}
        style={{
          color: colors.registerBtnColor,
          fontSize: '0.8rem',
          textDecoration: 'none',
          padding: '4px 10px',
          borderRadius: 4,
          background: colors.registerBtnBg,
          fontWeight: 600,
        }}
      >
        Register
      </Link>
    </div>
  );
}
