import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Avatar } from '../common/Avatar.js';

interface EmbedData {
  type: 'channel' | 'dm';
  id: string;
  content: string;
  channelId?: string;
  channelName?: string;
  spaceId?: string;
  conversationId?: string;
  author?: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
}

// Module-level cache to avoid refetching
const embedCache = new Map<string, EmbedData | null>();
const inflight = new Map<string, Promise<EmbedData | null>>();

async function fetchEmbed(messageId: string): Promise<EmbedData | null> {
  if (embedCache.has(messageId)) return embedCache.get(messageId)!;
  if (inflight.has(messageId)) return inflight.get(messageId)!;

  const promise = api<any>(`/messages/${messageId}`)
    .then((data) => {
      const result: EmbedData = {
        type: data.type,
        id: data.id,
        content: data.content,
        channelId: data.channelId,
        channelName: data.channelName,
        spaceId: data.spaceId,
        conversationId: data.conversationId,
        author: data.author,
      };
      embedCache.set(messageId, result);
      return result;
    })
    .catch(() => {
      embedCache.set(messageId, null);
      return null;
    })
    .finally(() => {
      inflight.delete(messageId);
    });

  inflight.set(messageId, promise);
  return promise;
}

interface Props {
  messageId: string;
}

export function MessageLinkEmbed({ messageId }: Props) {
  const [data, setData] = useState<EmbedData | null | undefined>(
    embedCache.has(messageId) ? embedCache.get(messageId) : undefined,
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (data !== undefined) return;
    let cancelled = false;
    fetchEmbed(messageId).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => { cancelled = true; };
  }, [messageId, data]);

  // Still loading or failed
  if (data === undefined) {
    return (
      <div style={styles.skeleton}>
        <div style={styles.skeletonBar} />
      </div>
    );
  }
  if (data === null) return null;

  const preview = data.content.length > 200 ? data.content.slice(0, 200) + '...' : data.content;

  const handleClick = () => {
    if (data.type === 'channel' && data.spaceId && data.channelId) {
      navigate(`/space/${data.spaceId}/channel/${data.channelId}/message/${data.id}`);
    } else if (data.type === 'dm' && data.conversationId) {
      navigate(`/dm/${data.conversationId}/message/${data.id}`);
    }
  };

  const sourceLabel = data.type === 'channel' && data.channelName
    ? `#${data.channelName}`
    : 'Direct Message';

  return (
    <button onClick={handleClick} style={styles.embed}>
      <div style={styles.accentBar} />
      <div style={styles.embedContent}>
        <div style={styles.embedHeader}>
          <Avatar
            src={data.author?.avatarUrl || null}
            name={data.author?.displayName || '?'}
            size={20}
          />
          <span style={styles.embedAuthor}>{data.author?.displayName || 'Unknown'}</span>
          <span style={styles.embedSource}>{sourceLabel}</span>
        </div>
        <div style={styles.embedPreview}>{preview}</div>
      </div>
    </button>
  );
}

export function extractMessageLinks(content: string): string[] {
  const origin = window.location.origin;
  const ids: string[] = [];
  // Match full URLs with our origin, or bare paths
  const fullRe = new RegExp(
    `(?:${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?(?:/space/\\d+/channel/\\d+/message/(\\d+)|/dm/\\d+/message/(\\d+))`,
    'g',
  );
  let m;
  while ((m = fullRe.exec(content)) !== null) {
    const id = m[1] || m[2];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
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
    maxWidth: 480,
    textAlign: 'left',
    padding: 0,
    width: '100%',
  },
  accentBar: {
    width: 4,
    background: 'var(--accent)',
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
    gap: 6,
    marginBottom: 4,
  },
  embedAuthor: {
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  embedSource: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  embedPreview: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },
  skeleton: {
    marginTop: 6,
    maxWidth: 480,
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
