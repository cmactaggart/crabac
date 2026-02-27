import { useState } from 'react';
import { Mail } from 'lucide-react';

interface Props {
  sourceType: 'space' | 'user';
  sourceId: string;
  theme?: any;
}

export function NewsletterSubscribeForm({ sourceType, sourceId, theme }: Props) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('immediate');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/newsletter-public/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sourceType, sourceId, frequency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to subscribe');
      setMessage(data.message || 'Check your email to verify your subscription!');
      setEmail('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const accent = theme?.accent || '#5865f2';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Mail size={18} style={{ color: accent }} />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Subscribe to Newsletter</span>
      </div>

      {message ? (
        <div style={{ padding: '12px 16px', background: 'rgba(67, 181, 129, 0.1)', borderRadius: 6, fontSize: '0.9rem', color: '#43b581' }}>
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '8px 16px', background: accent, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {loading ? '...' : 'Subscribe'}
            </button>
          </div>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.85rem', color: '#555', background: '#fff', maxWidth: 200 }}
          >
            <option value="immediate">Every newsletter</option>
            <option value="daily_digest">Daily digest</option>
            <option value="weekly_digest">Weekly digest</option>
          </select>
          {error && <div style={{ fontSize: '0.85rem', color: '#c00' }}>{error}</div>}
        </form>
      )}
    </div>
  );
}
