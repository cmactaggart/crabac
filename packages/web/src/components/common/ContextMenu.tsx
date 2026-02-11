import type React from 'react';
import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  separator?: boolean;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div ref={menuRef} style={{ ...styles.menu, left: x, top: y }}>
      {items.map((item, i) => (
        item.separator ? (
          <div key={i} style={styles.separator} />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            style={{
              ...styles.item,
              color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
            }}
          >
            {item.icon && <span style={styles.icon}>{item.icon}</span>}
            {item.label}
          </button>
        )
      ))}
    </div>
  );
}

// Hook for long-press detection (mobile)
export function useLongPress(callback: (e: React.TouchEvent) => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };
    timerRef.current = setTimeout(() => {
      callback(e);
    }, delay);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current || !timerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchRef.current.x);
    const dy = Math.abs(touch.clientY - touchRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'fixed',
    zIndex: 200,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '4px 0',
    minWidth: 180,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  icon: {
    width: 20,
    textAlign: 'center',
    fontSize: '0.95rem',
  },
  separator: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
};
