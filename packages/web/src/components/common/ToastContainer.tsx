import { useEffect, useState } from 'react';
import { useToastStore, type Toast } from '../../stores/toast.js';
import { X } from 'lucide-react';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const bgColor =
    toast.type === 'success'
      ? 'var(--success, #22c55e)'
      : toast.type === 'error'
        ? 'var(--danger, #ef4444)'
        : 'var(--bg-secondary, #374151)';

  return (
    <div
      style={{
        ...styles.toast,
        background: bgColor,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
      }}
    >
      <span style={styles.message}>{toast.message}</span>
      <button onClick={onDismiss} style={styles.dismiss} title="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    pointerEvents: 'none',
    maxWidth: 360,
  },
  toast: {
    pointerEvents: 'auto',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'transform 0.25s ease, opacity 0.25s ease',
  },
  message: {
    flex: 1,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
};
