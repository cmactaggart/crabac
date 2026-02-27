import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { LetterIcon } from '../icons/LetterIcon.js';

interface SpaceEmbedData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  memberCount: number;
  channelCount: number;
  baseColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  isPublic: boolean;
}

// Module-level cache to avoid refetching (keyed by "id:{id}" or "slug:{slug}")
const embedCache = new Map<string, SpaceEmbedData | null>();
const inflight = new Map<string, Promise<SpaceEmbedData | null>>();

async function fetchSpaceEmbedByKey(key: string): Promise<SpaceEmbedData | null> {
  if (embedCache.has(key)) return embedCache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const isSlug = key.startsWith('slug:');
  const value = isSlug ? key.slice(5) : key.slice(3);
  const url = isSlug
    ? `/spaces/by-slug/${encodeURIComponent(value)}/embed`
    : `/spaces/${value}/embed`;

  const promise = api<SpaceEmbedData>(url)
    .then((data) => {
      embedCache.set(key, data);
      // Also cache under both keys so we don't refetch
      embedCache.set(`id:${data.id}`, data);
      embedCache.set(`slug:${data.slug}`, data);
      return data;
    })
    .catch(() => {
      embedCache.set(key, null);
      return null;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

interface Props {
  spaceId?: string;
  spaceSlug?: string;
}

export function SpaceLinkEmbed({ spaceId, spaceSlug }: Props) {
  const cacheKey = spaceId ? `id:${spaceId}` : `slug:${spaceSlug}`;
  const [data, setData] = useState<SpaceEmbedData | null | undefined>(
    embedCache.has(cacheKey) ? embedCache.get(cacheKey) : undefined,
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (data !== undefined) return;
    let cancelled = false;
    fetchSpaceEmbedByKey(cacheKey).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => { cancelled = true; };
  }, [cacheKey, data]);

  // Still loading
  if (data === undefined) {
    return (
      <div style={styles.skeleton}>
        <div style={styles.skeletonBar} />
      </div>
    );
  }
  // Failed / not found
  if (data === null) return null;

  const accentBar = data.accentColor || 'var(--accent)';
  const hasGradient = data.baseColor && data.accentColor;

  return (
    <button onClick={() => navigate(`/space/${data.id}`)} style={styles.embed}>
      <div style={{ ...styles.accentBar, background: accentBar }} />
      <div style={styles.embedContent}>
        <div style={styles.embedHeader}>
          {data.iconUrl ? (
            <div style={styles.iconWrap}>
              <img src={data.iconUrl} alt="" style={styles.iconImg} />
            </div>
          ) : (
            <LetterIcon
              letter={data.name.charAt(0)}
              size={32}
              bg={data.baseColor || 'var(--accent)'}
              gradient={hasGradient ? { base: data.baseColor!, accent: data.accentColor! } : undefined}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.embedName}>{data.name}</div>
            <div style={styles.embedSlug}>/{data.slug}</div>
          </div>
        </div>
        {data.description && (
          <div style={styles.embedDescription}>{data.description}</div>
        )}
        <div style={styles.embedStats}>
          {data.memberCount} members · {data.channelCount} channels
        </div>
      </div>
    </button>
  );
}

export interface SpaceLinkRef {
  type: 'id' | 'slug';
  value: string;
  key: string; // unique key for dedup
}

export function extractSpaceLinks(content: string): SpaceLinkRef[] {
  const origin = window.location.origin;
  const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refs: SpaceLinkRef[] = [];
  const seen = new Set<string>();

  // Match:
  // 1. Markdown links [text](/space/{id}) or [text](/space/slug/{slug})
  // 2. Full URLs: {origin}/space/{id}, {origin}/space/slug/{slug}
  // 3. Bare paths: /space/{id}, /space/slug/{slug}
  const re = new RegExp(
    `(?:\\[[^\\]]+\\]\\(\\/space\\/(?:slug\\/([a-zA-Z0-9_-]+)|(\\d+))\\))|(?:${escapedOrigin})\\/space\\/(?:slug\\/([a-zA-Z0-9_-]+)|(\\d+))|\\/space\\/(?:slug\\/([a-zA-Z0-9_-]+)|(\\d+))`,
    'g',
  );
  let m;
  while ((m = re.exec(content)) !== null) {
    // Groups: 1=md-slug, 2=md-id, 3=full-slug, 4=full-id, 5=bare-slug, 6=bare-id
    const slug = m[1] || m[3] || m[5];
    const id = m[2] || m[4] || m[6];
    if (slug) {
      const key = `slug:${slug}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ type: 'slug', value: slug, key }); }
    } else if (id) {
      const key = `id:${id}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ type: 'id', value: id, key }); }
    }
  }
  return refs;
}

const styles: Record<string, React.CSSProperties> = {
  embed: {
    display: 'flex',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    marginTop: 6,
    maxWidth: 'min(480px, 100%)',
    textAlign: 'left',
    padding: 0,
    width: '100%',
  },
  accentBar: {
    width: 4,
    flexShrink: 0,
  },
  embedContent: {
    padding: '8px 12px',
    flex: 1,
    minWidth: 0,
  },
  embedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
  },
  iconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  embedName: {
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  embedSlug: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  embedDescription: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  embedStats: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  skeleton: {
    marginTop: 6,
    maxWidth: 'min(480px, 100%)',
    padding: '12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  skeletonBar: {
    height: 12,
    width: '60%',
    background: 'var(--bg-tertiary)',
    borderRadius: 4,
  },
};
