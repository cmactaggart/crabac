import { useState, useEffect, useCallback } from 'react';
import { MessageSquareDashed, Plus } from 'lucide-react';
import { useForumsStore } from '../../stores/forums.js';
import { getSocket } from '../../lib/socket.js';
import { ThreadList } from './ThreadList.js';
import { ThreadDetailView } from './ThreadDetailView.js';
import { CreateThreadModal } from './CreateThreadModal.js';
import type { Channel, ForumThread, ForumThreadSummary } from '@crabac/shared';

interface Props {
  channelId: string;
  channel: Channel | null;
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
  canModerate?: boolean;
}

export function ForumChannelView({ channelId, channel, spaceId, showBackButton, onBack, canModerate }: Props) {
  const {
    threads, loading, activeThread,
    fetchThreads, createThread, setActiveThread,
    getThread, addThread, updateThreadInList, clearThreads,
  } = useForumsStore();
  const [showCreateThread, setShowCreateThread] = useState(false);

  useEffect(() => {
    clearThreads();
    fetchThreads(spaceId, channelId);
  }, [spaceId, channelId, fetchThreads, clearThreads]);

  // Socket: listen for new threads in this channel
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('channel:join', { channelId });

    const onThreadCreated = (thread: ForumThreadSummary) => {
      addThread(thread);
    };
    const onThreadUpdated = (thread: ForumThread) => {
      updateThreadInList(thread);
    };

    socket.on('forum:thread_created', onThreadCreated);
    socket.on('forum:thread_updated', onThreadUpdated);

    return () => {
      socket.emit('channel:leave', { channelId });
      socket.off('forum:thread_created', onThreadCreated);
      socket.off('forum:thread_updated', onThreadUpdated);
    };
  }, [channelId, addThread, updateThreadInList]);

  const handleThreadClick = useCallback(
    async (thread: ForumThreadSummary) => {
      await getThread(spaceId, channelId, thread.id);
    },
    [spaceId, channelId, getThread],
  );

  const handleLoadMore = useCallback(
    (before: string) => {
      fetchThreads(spaceId, channelId, { before });
    },
    [spaceId, channelId, fetchThreads],
  );

  const handleCreateThread = async (data: { title: string; content: string }) => {
    await createThread(spaceId, channelId, data);
    fetchThreads(spaceId, channelId);
  };

  // Thread detail view
  if (activeThread) {
    return (
      <ThreadDetailView
        spaceId={spaceId}
        channelId={channelId}
        thread={activeThread}
        onBack={() => setActiveThread(null)}
        canModerate={canModerate}
      />
    );
  }

  // Thread listing view
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {showBackButton && onBack && (
          <button onClick={onBack} style={styles.backBtn}>Back</button>
        )}
        <div style={styles.headerInfo}>
          <MessageSquareDashed size={20} style={{ color: 'var(--text-muted)' }} />
          <h3 style={styles.channelName}>{channel?.name || 'Forum'}</h3>
          {channel?.topic && (
            <span style={styles.topic}>{channel.topic}</span>
          )}
        </div>
        <button
          onClick={() => setShowCreateThread(true)}
          style={styles.newThreadBtn}
        >
          <Plus size={16} />
          New Thread
        </button>
      </div>

      <div style={styles.content}>
        <ThreadList
          threads={threads}
          loading={loading}
          onThreadClick={handleThreadClick}
          onLoadMore={handleLoadMore}
        />
      </div>

      {showCreateThread && (
        <CreateThreadModal
          onSubmit={handleCreateThread}
          onClose={() => setShowCreateThread(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  channelName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  topic: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  newThreadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: 12,
  },
};
