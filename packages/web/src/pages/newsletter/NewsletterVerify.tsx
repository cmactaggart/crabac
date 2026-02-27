import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function NewsletterVerify() {
  const { token } = useParams();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError('Missing token'); setLoading(false); return; }
    fetch(`/api/newsletter-public/verify/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) setMessage(data.message);
        else setError('Verification failed');
        setLoading(false);
      })
      .catch(() => {
        setError('Invalid or expired verification link');
        setLoading(false);
      });
  }, [token]);

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '32px 24px', textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {loading ? (
        <p style={{ color: '#888' }}>Verifying your subscription...</p>
      ) : message ? (
        <div>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>Subscription Verified</h1>
          <p style={{ color: '#555', lineHeight: 1.6 }}>{message}</p>
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: 16 }}>You can close this page.</p>
        </div>
      ) : (
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c00', marginBottom: 12 }}>Verification Failed</h1>
          <p style={{ color: '#555' }}>{error}</p>
        </div>
      )}
      <div style={{ marginTop: 40, fontSize: '0.75rem', color: '#999' }}>Powered by crab.ac</div>
    </div>
  );
}
