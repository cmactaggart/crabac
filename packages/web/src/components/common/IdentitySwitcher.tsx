import { useState, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Avatar } from './Avatar.js';
import { useIdentityStore } from '../../stores/identity.js';
import { useAuthStore } from '../../stores/auth.js';

export function IdentitySwitcher() {
  const user = useAuthStore((s) => s.user);
  const { activeSpaceId, managedSpaces, setActiveSpace, fetchManagedSpaces } = useIdentityStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchManagedSpaces();
  }, []);

  if (managedSpaces.length === 0) return null;

  const activeSpace = managedSpaces.find((s) => s.id === activeSpaceId);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 10px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontWeight: 600,
        }}
      >
        <Avatar
          src={activeSpace ? activeSpace.iconUrl : (user?.avatarUrl ?? null)}
          name={activeSpace ? activeSpace.name : (user?.displayName || '?')}
          size={20}
          baseColor={activeSpace?.baseColor ?? user?.baseColor ?? null}
          accentColor={activeSpace?.accentColor ?? user?.accentColor ?? null}
        />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeSpace ? activeSpace.name : 'Posting as you'}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '100%',
            marginBottom: 4,
            zIndex: 100,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: 4,
            maxHeight: 240,
            overflowY: 'auto',
          }}>
            {/* Personal identity */}
            <button
              onClick={() => { setActiveSpace(null); setOpen(false); }}
              style={menuItemStyle}
            >
              <Avatar
                src={user?.avatarUrl ?? null}
                name={user?.displayName || '?'}
                size={20}
                baseColor={user?.baseColor ?? null}
                accentColor={user?.accentColor ?? null}
              />
              <span style={{ flex: 1, textAlign: 'left' }}>{user?.displayName}</span>
              {!activeSpaceId && <Check size={14} style={{ color: 'var(--accent)' }} />}
            </button>

            {/* Space identities */}
            {managedSpaces.map((space) => (
              <button
                key={space.id}
                onClick={() => { setActiveSpace(space.id); setOpen(false); }}
                style={menuItemStyle}
              >
                <Avatar
                  src={space.iconUrl}
                  name={space.name}
                  size={20}
                  baseColor={space.baseColor ?? null}
                  accentColor={space.accentColor ?? null}
                />
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{space.name}</span>
                {activeSpaceId === space.id && <Check size={14} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 10px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  borderRadius: 'var(--radius)',
  fontSize: '0.78rem',
  fontWeight: 500,
};
