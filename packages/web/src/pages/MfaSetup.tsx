import { useState } from 'react';
import { api } from '../lib/api.js';
import type { TotpSetupResponse } from '@crabac/shared';

export function MfaSetup({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'backup' | 'done'>('idle');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSetup = async () => {
    setError('');
    setSubmitting(true);
    try {
      const data = await api<TotpSetupResponse>('/mfa/totp/setup', { method: 'POST' });
      setSetupData(data);
      setStep('setup');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api('/mfa/totp/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setStep('backup');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setStep('done');
    onComplete?.();
  };

  if (step === 'idle') {
    return (
      <div style={styles.section}>
        <h3 style={styles.heading}>Two-Factor Authentication</h3>
        <p style={styles.text}>Add an extra layer of security to your account with an authenticator app.</p>
        {error && <div style={styles.error}>{error}</div>}
        <button onClick={handleSetup} disabled={submitting} style={styles.button}>
          {submitting ? 'Setting up...' : 'Set up TOTP'}
        </button>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div style={styles.section}>
        <h3 style={styles.heading}>Scan QR Code</h3>
        <p style={styles.text}>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
        {setupData && (
          <>
            <img src={setupData.qrCodeUrl} alt="TOTP QR Code" style={{ alignSelf: 'center', borderRadius: 8 }} />
            <details style={{ marginTop: 8 }}>
              <summary style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Can't scan? Enter manually
              </summary>
              <code style={styles.code}>{setupData.secret}</code>
            </details>
          </>
        )}
        <button onClick={() => setStep('confirm')} style={styles.button}>Next</button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div style={styles.section}>
        <h3 style={styles.heading}>Enter verification code</h3>
        <p style={styles.text}>Enter the 6-digit code from your authenticator app to confirm setup.</p>
        {error && <div style={styles.error}>{error}</div>}
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          maxLength={6}
          style={styles.input}
          autoComplete="one-time-code"
        />
        <button onClick={handleConfirm} disabled={submitting || code.length !== 6} style={styles.button}>
          {submitting ? 'Verifying...' : 'Confirm'}
        </button>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div style={styles.section}>
        <h3 style={styles.heading}>Save your backup codes</h3>
        <p style={styles.text}>
          Store these codes somewhere safe. You can use them to sign in if you lose access to your authenticator app.
          Each code can only be used once.
        </p>
        <div style={styles.codeGrid}>
          {setupData?.backupCodes.map((c, i) => (
            <code key={i} style={styles.backupCode}>{c}</code>
          ))}
        </div>
        <button onClick={handleDone} style={styles.button}>I've saved these codes</button>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.heading}>Two-factor authentication enabled</h3>
      <p style={styles.text}>Your account is now protected with TOTP two-factor authentication.</p>
    </div>
  );
}

export function MfaDisable({ onComplete }: { onComplete?: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDisable = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api('/mfa/totp/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      onComplete?.();
    } catch (err: any) {
      setError(err.message || 'Failed to disable MFA');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.section}>
      <h3 style={styles.heading}>Disable Two-Factor Authentication</h3>
      {error && <div style={styles.error}>{error}</div>}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your password"
        style={styles.input}
      />
      <button onClick={handleDisable} disabled={submitting || !password} style={{ ...styles.button, background: 'var(--danger)' }}>
        {submitting ? 'Disabling...' : 'Disable MFA'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  heading: {
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  text: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  input: {
    padding: '0.7rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
    textAlign: 'center',
    letterSpacing: '0.2em',
  },
  button: {
    padding: '0.6rem 1rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
  },
  code: {
    display: 'block',
    background: 'var(--bg-input)',
    padding: '0.5rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    wordBreak: 'break-all',
    marginTop: '0.5rem',
  },
  codeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  backupCode: {
    background: 'var(--bg-input)',
    padding: '0.4rem 0.6rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
};
