import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function NewsletterPreferences() {
  const { token } = useParams();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/newsletter-public/preferences/${token}`)
      .then((r) => r.json())
      .then((data) => { setPrefs(data); setLoading(false); })
      .catch(() => { setError('Invalid or expired link'); setLoading(false); });
  }, [token]);

  const handleUpdate = async (updates: Record<string, any>) => {
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/newsletter-public/preferences/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      setPrefs(data);
      setMessage('Preferences updated');
    } catch { setError('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await fetch(`/api/newsletter-public/unsubscribe/${token}`);
      setMessage('You have been unsubscribed.');
      setPrefs((p: any) => p ? { ...p, isActive: false } : p);
    } catch { setError('Failed to unsubscribe'); }
    finally { setSaving(false); }
  };

  if (loading) return <Page><p style={{ color: '#888' }}>Loading...</p></Page>;
  if (error && !prefs) return <Page><p style={{ color: '#c00' }}>{error}</p></Page>;

  return (
    <Page>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Newsletter Preferences</h1>

      {message && <div style={{ padding: '12px 16px', background: 'rgba(67,181,129,0.1)', borderRadius: 6, marginBottom: 16, color: '#43b581' }}>{message}</div>}

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Delivery Frequency</label>
        <select
          value={prefs?.frequency || 'immediate'}
          onChange={(e) => handleUpdate({ frequency: e.target.value })}
          disabled={saving || !prefs?.isActive}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem' }}
        >
          <option value="immediate">Every newsletter</option>
          <option value="daily_digest">Daily digest</option>
          <option value="weekly_digest">Weekly digest</option>
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Status</label>
        <p style={{ margin: 0, color: prefs?.isActive ? '#43b581' : '#888' }}>
          {prefs?.isActive ? 'Active' : 'Unsubscribed'}
        </p>
      </div>

      {prefs?.isActive ? (
        <button onClick={handleUnsubscribe} disabled={saving} style={{ padding: '10px 20px', background: '#ed4245', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          {saving ? 'Processing...' : 'Unsubscribe'}
        </button>
      ) : (
        <button onClick={() => handleUpdate({ isActive: true })} disabled={saving} style={{ padding: '10px 20px', background: '#5865f2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          {saving ? 'Processing...' : 'Re-subscribe'}
        </button>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '32px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {children}
      <div style={{ marginTop: 40, textAlign: 'center', fontSize: '0.75rem', color: '#999' }}>Powered by crab.ac</div>
    </div>
  );
}
