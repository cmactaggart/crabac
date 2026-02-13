import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Pin, Search, Users, ArrowLeft } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell.js';
import { useMessagesStore } from '../../stores/messages.js';
import { useAuthStore } from '../../stores/auth.js';
import { useLayoutStore } from '../../stores/layout.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useDMStore } from '../../stores/dm.js';
import { useChannelSocket } from '../../hooks/useSocket.js';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { PinnedMessages } from './PinnedMessages.js';
import { ThreadPanel } from './ThreadPanel.js';
import { SearchPanel } from './SearchPanel.js';
import { UserProfilePopover } from '../common/UserProfilePopover.js';
import type { Channel, Message } from '@crabac/shared';

interface Props {
  channelId: string;
  channel: Channel | null;
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function MessageArea({ channelId, channel, spaceId, showBackButton, onBack }: Props) {
  const {
    messages, loading, hasMore,
    fetchMessages, clearMessages, sendMessage,
    typingUsers, replyingTo, setReplyingTo,
    showPins, showThread, showSearch,
    togglePins, toggleSearch,
  } = useMessagesStore();
  const userId = useAuthStore((s) => s.user?.id);
  const { membersSidebarOpen, toggleMembersSidebar } = useLayoutStore();
  const markRead = useChannelsStore((s) => s.markRead);
  const createConversation = useDMStore((s) => s.createConversation);
  const navigate = useNavigate();

  const [profilePopover, setProfilePopover] = useState<{ userId: string; rect: DOMRect } | null>(null);

  useChannelSocket(channelId);

  useEffect(() => {
    clearMessages();
    fetchMessages(channelId);
  }, [channelId, fetchMessages, clearMessages]);

  // Mark channel as read when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && spaceId) {
      const lastMsg = messages[messages.length - 1];
      markRead(spaceId, channelId, lastMsg.id);
    }
  }, [messages.length, spaceId, channelId, markRead]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore || messages.length === 0) return;
    fetchMessages(channelId, messages[0].id);
  }, [channelId, loading, hasMore, messages, fetchMessages]);

  const handleSend = useCallback(
    async (content: string, replyToId?: string) => {
      await sendMessage(channelId, content, replyToId);
    },
    [channelId, sendMessage],
  );

  const handleReply = useCallback(
    (message: Message) => {
      setReplyingTo(message);
    },
    [setReplyingTo],
  );

  const handleUserClick = useCallback(
    (clickedUserId: string, rect: DOMRect) => {
      setProfilePopover({ userId: clickedUserId, rect });
    },
    [],
  );

  const handleProfileMessage = useCallback(
    async (targetUserId: string) => {
      try {
        const conversation = await createConversation(targetUserId);
        navigate(`/dm/${conversation.id}`);
      } catch {
        // ignore errors
      }
    },
    [createConversation, navigate],
  );

  const typingNames = Array.from(typingUsers.values())
    .map((t) => t.username)
    .filter(Boolean);

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            {showBackButton && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <ArrowLeft size={20} />
              </button>
            )}
            <Hash size={20} style={{ color: 'var(--text-muted)' }} />
            <span style={styles.channelName}>{channel?.name || 'channel'}</span>
            {channel?.topic && (
              <>
                <span style={styles.divider} />
                <span style={styles.topic}>{channel.topic}</span>
              </>
            )}
          </div>
          <div style={styles.headerActions}>
            <NotificationBell />
            <button
              onClick={togglePins}
              style={{ ...styles.headerBtn, color: showPins ? 'var(--accent)' : 'var(--text-secondary)' }}
              title="Pinned Messages"
            >
              <Pin size={18} />
            </button>
            <button
              onClick={toggleSearch}
              style={{ ...styles.headerBtn, color: showSearch ? 'var(--accent)' : 'var(--text-secondary)' }}
              title="Search"
            >
              <Search size={18} />
            </button>
            <button
              onClick={toggleMembersSidebar}
              style={{ ...styles.headerBtn, color: membersSidebarOpen ? 'var(--accent)' : 'var(--text-secondary)' }}
              title="Members"
            >
              <Users size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          loading={loading}
          hasMore={hasMore}
          currentUserId={userId || ''}
          channelId={channelId}
          spaceId={spaceId}
          onReply={handleReply}
          onUserClick={handleUserClick}
        />

        {/* Typing indicator */}
        <div style={styles.typingBar}>
          {typingNames.length > 0 && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              <strong>{typingNames.join(', ')}</strong>
              {typingNames.length === 1 ? ' is' : ' are'} typing...
            </span>
          )}
        </div>

        {/* Input */}
        <MessageInput
          channelId={channelId}
          spaceId={spaceId}
          onSend={handleSend}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {/* Side panels */}
      {showPins && <PinnedMessages channelId={channelId} />}
      {showThread && <ThreadPanel channelId={channelId} />}
      {showSearch && <SearchPanel spaceId={spaceId} />}

      {profilePopover && (
        <UserProfilePopover
          userId={profilePopover.userId}
          anchorRect={profilePopover.rect}
          onClose={() => setProfilePopover(null)}
          onMessage={handleProfileMessage}
          currentUserId={userId || ''}
          spaceId={spaceId}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 48,
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  headerBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  hash: {
    color: 'var(--text-muted)',
    fontSize: '1.3rem',
    fontWeight: 500,
  },
  channelName: {
    fontWeight: 700,
    fontSize: '1rem',
  },
  divider: {
    width: 1,
    height: 20,
    background: 'var(--border)',
  },
  topic: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typingBar: {
    height: 20,
    padding: '0 16px',
    flexShrink: 0,
  },
};
