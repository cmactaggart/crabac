import { useState, useMemo } from 'react';
import { X, Upload, MapPin, Mountain, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api.js';
import type { RouteCategory, RouteItem } from '@crabac/shared';
import { usePreferencesStore } from '../../stores/preferences.js';
import type { DistanceUnits } from '@crabac/shared';

interface Props {
  channelId: string;
  spaceId: string;
  categories: RouteCategory[];
  onClose: () => void;
  onComplete: () => void;
}

function formatDistance(km: number, units: DistanceUnits): string {
  if (units === 'imperial') return `${(km * 0.621371).toFixed(1)} mi`;
  return `${km.toFixed(1)} km`;
}

function formatElevation(m: number, units: DistanceUnits): string {
  if (units === 'imperial') return `${Math.round(m * 3.28084)} ft`;
  return `${m} m`;
}

export function RouteUploadModal({ channelId, spaceId, categories, onClose, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [activityType, setActivityType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');

    // Pre-fill name from filename
    const defaultName = f.name.replace(/\.gpx$/i, '');
    setName(defaultName);

    // Try to parse GPX client-side for preview
    try {
      const text = await f.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const trkName = doc.querySelector('trk > name')?.textContent || doc.querySelector('rte > name')?.textContent;
      if (trkName) setName(trkName);

      // Extract basic coords for mini map
      const points: [number, number][] = [];
      for (const pt of doc.querySelectorAll('trkpt, rtept')) {
        const lat = parseFloat(pt.getAttribute('lat') || '');
        const lng = parseFloat(pt.getAttribute('lon') || '');
        if (!isNaN(lat) && !isNaN(lng)) points.push([lng, lat]);
      }
      setPreview({ points, trackName: trkName });
    } catch {
      // ignore preview parse failure
    }
  };

  const previewPolyline = useMemo(() => {
    if (!preview?.points?.length) return '';
    const coords = preview.points;
    const maxPts = 80;
    let sampled = coords;
    if (coords.length > maxPts) {
      const step = (coords.length - 1) / (maxPts - 1);
      sampled = [];
      for (let i = 0; i < maxPts - 1; i++) sampled.push(coords[Math.round(i * step)]);
      sampled.push(coords[coords.length - 1]);
    }
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of sampled) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const pad = 0.08;
    const lngRange = (maxLng - minLng) || 0.001;
    const latRange = (maxLat - minLat) || 0.001;
    return sampled
      .map(([lng, lat]: [number, number]) => {
        const x = ((lng - minLng) / lngRange) * (1 - 2 * pad) + pad;
        const y = (1 - (lat - minLat) / latRange) * (1 - 2 * pad) + pad;
        return `${(x * 280).toFixed(1)},${(y * 160).toFixed(1)}`;
      })
      .join(' ');
  }, [preview]);

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name.trim());
      if (description.trim()) form.append('description', description.trim());
      if (categoryId) form.append('categoryId', categoryId);
      if (isPublic) form.append('isPublic', 'true');
      if (activityType) form.append('activityType', activityType);

      await api<RouteItem>(`/channels/${channelId}/routes/upload`, {
        method: 'POST',
        body: form,
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Upload Route</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {!file ? (
            <label style={styles.dropzone}>
              <Upload size={32} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click to select a GPX file</span>
              <input type="file" accept=".gpx" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          ) : (
            <>
              {previewPolyline && (
                <div style={styles.previewMap}>
                  <svg viewBox="0 0 280 160" style={{ width: '100%', height: '100%' }}>
                    <polyline
                      points={previewPolyline}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

              <div style={styles.fileInfo}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                <button onClick={() => { setFile(null); setPreview(null); setName(''); }} style={{ ...styles.closeBtn, padding: 2 }}>
                  <X size={14} />
                </button>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Route name"
                  style={styles.input}
                  maxLength={200}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this route..."
                  style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
                  maxLength={4000}
                />
              </div>

              {categories.length > 0 && (
                <div style={styles.field}>
                  <label style={styles.label}>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={styles.input}
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={styles.field}>
                <label style={styles.label}>Activity Type <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  style={styles.input}
                >
                  <option value="">None</option>
                  <option value="ride">Ride</option>
                  <option value="run">Run</option>
                  <option value="walk">Walk</option>
                </select>
              </div>

              <div style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  id="route-public"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <label htmlFor="route-public" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Make this route public
                </label>
              </div>
            </>
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleUpload}
            disabled={!file || !name.trim() || uploading}
            style={{
              ...styles.uploadSubmitBtn,
              opacity: !file || !name.trim() || uploading ? 0.5 : 1,
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Route'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--bg-primary)', borderRadius: 'var(--radius)', width: 480, maxWidth: '90vw', maxHeight: '90vh', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'auto', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius)' },
  body: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  error: { background: 'rgba(237, 66, 69, 0.15)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '0.85rem' },
  dropzone: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, border: '2px dashed var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--bg-secondary)' },
  previewMap: { height: 140, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  fileInfo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' },
  input: { padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  cancelBtn: { padding: '8px 16px', background: 'none', border: 'none', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.85rem' },
  uploadSubmitBtn: { padding: '8px 20px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
};
