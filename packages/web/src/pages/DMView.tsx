import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Copy, Link2, Pencil, Trash2, PanelLeftClose, PanelLeft, UserPlus, Users, LogOut as LeaveIcon, Check, X, Clock, UserMinus, ArrowLeft, Flag, Ban, SmilePlus, Paperclip, Search, Forward, BellOff, Bell } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useDMStore } from '../stores/dm.js';
import { useFollowsStore } from '../stores/follows.js';
import { useBlocksStore } from '../stores/blocks.js';
import { useLayoutStore } from '../stores/layout.js';
import { ReportModal } from '../components/moderation/ReportModal.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useDMSocket, useDMTypingEmit } from '../hooks/useDMSocket.js';
import { useFollowsSocket } from '../hooks/useFollowsSocket.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { Avatar } from '../components/common/Avatar.js';
import { ContextMenu, useLongPress, type ContextMenuItem } from '../components/common/ContextMenu.js';
import { EmojiPicker } from '../components/messages/EmojiPicker.js';
import { MessageEmbeds } from '../components/messages/MessageEmbeds.js';
import { MessageAttachments } from '../components/messages/MessageAttachments.js';
import { ReactionBar } from '../components/messages/ReactionBar.js';
import { api } from '../lib/api.js';
import { SearchPanel } from '../components/search/SearchPanel.js';
import { ShareToSpacePicker } from '../components/common/ShareToSpacePicker.js';
import type { DirectMessage, Conversation, FollowStatus } from '@crabac/shared';

export function DMView() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const { channelSidebarOpen, mobileView, setMobileView, toggleChannelSidebar } = useLayoutStore();
  const { spaces, fetchSpaces } = useSpacesStore();
  const {
    conversations,
    messageRequests,
    messages,
    loading,
    hasMore,
    typingUsers,
    dmUnreads,
    showDMSearch,
    fetchConversations,
    fetchMessageRequests,
    fetchDMUnreads,
    openConversation,
    fetchMessages,
    sendMessage,
    sendMessageWithFiles,
    clearMessages,
    toggleDMSearch,
    clearDMSearch,
    muteConversation,
    unmuteConversation,
    deleteConversation,
  } = useDMStore();

  const [showGroupMembers, setShowGroupMembers] = useState(false);

  useDMSocket(conversationId || null);
  useFollowsSocket();

  useEffect(() => {
    fetchSpaces();
    fetchConversations();
    fetchMessageRequests();
    fetchDMUnreads();
  }, [fetchSpaces, fetchConversations, fetchMessageRequests, fetchDMUnreads]);

  useEffect(() => {
    if (conversationId) {
      openConversation(conversationId);
      if (isMobile) setMobileView('chat');
    } else {
      clearMessages();
    }
  }, [conversationId, openConversation, clearMessages, isMobile, setMobileView]);

  const activeConv = conversations.find((c) => c.id === conversationId);
  const isGroup = activeConv?.type === 'group';
  const otherParticipant = activeConv && !isGroup
    ? activeConv.participants.find((p) => p.id !== user?.id)
    : null;

  const typingNames = Array.from(typingUsers.values())
    .map((t) => t.username)
    .filter(Boolean);

  const chatContent = conversationId && activeConv ? (
    <div style={styles.chatContainer}>
      {/* Header */}
      <div style={styles.header}>
        {isMobile && (
          <button
            onClick={() => {
              setMobileView('sidebar');
              navigate('/dm', { replace: true });
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        {isGroup ? (
          <GroupDMHeaderContent conversation={activeConv} currentUserId={user?.id || ''} />
        ) : (
          <DMHeaderContent otherParticipant={otherParticipant} currentUserId={user?.id || ''} />
        )}
        <button
          onClick={async () => {
            if (activeConv.muted) {
              await unmuteConversation(conversationId);
            } else {
              await muteConversation(conversationId);
            }
          }}
          style={{ background: 'none', border: 'none', color: activeConv.muted ? 'var(--danger)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, flexShrink: 0 }}
          title={activeConv.muted ? 'Unmute' : 'Mute'}
        >
          {activeConv.muted ? <BellOff size={18} /> : <Bell size={18} />}
        </button>
        {isGroup && (
          <button
            onClick={() => setShowGroupMembers((v) => !v)}
            style={{ background: 'none', border: 'none', color: showGroupMembers ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, flexShrink: 0 }}
            title="Members"
          >
            <Users size={18} />
          </button>
        )}
        <button
          onClick={() => toggleDMSearch(conversationId)}
          style={{ background: 'none', border: 'none', color: showDMSearch ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, flexShrink: 0 }}
          title="Search"
        >
          <Search size={18} />
        </button>
      </div>

      {/* Messages */}
      <DMMessageList
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        currentUserId={user?.id || ''}
        conversationId={conversationId}
        onLoadMore={() => {
          if (!loading && hasMore && messages.length > 0) {
            fetchMessages(conversationId, messages[0].id);
          }
        }}
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
      <DMInput conversationId={conversationId} onSend={sendMessage} onSendWithFiles={sendMessageWithFiles} />
    </div>
  ) : null;

  const chatWithPanels = chatContent ? (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
      {chatContent}
      {showGroupMembers && isGroup && activeConv && (
        <GroupMembersPanel
          conversation={activeConv}
          currentUserId={user?.id || ''}
          onMessage={(userId) => {
            api<any>(`/conversations/with/${userId}`, { method: 'POST' })
              .then((conv) => navigate(`/dm/${conv.id}`))
              .catch(() => {});
          }}
          onClose={() => setShowGroupMembers(false)}
        />
      )}
      {showDMSearch && (
        <SearchPanel
          mode="dm"
          conversationId={conversationId}
          onClose={clearDMSearch}
        />
      )}
    </div>
  ) : null;

  // ─── Mobile Layout ───
  if (isMobile) {
    const showChat = conversationId && mobileView === 'chat' && activeConv;

    if (showChat) {
      return (
        <div style={mobileLayout}>
          {chatContent}
        </div>
      );
    }

    return (
      <div style={mobileLayout}>
        <div style={{ width: 72, flexShrink: 0, height: '100%' }}>
          <SpaceSidebar spaces={spaces} activeSpaceId={null} hideNavIcons={isMobile} />
        </div>
        <div style={{ flex: 1, height: '100%' }}>
          <DMSidebar
            conversations={conversations}
            messageRequests={messageRequests}
            activeConversationId={conversationId || null}
            currentUserId={user?.id || ''}
            user={user}
            dmUnreads={dmUnreads}
          />
        </div>
      </div>
    );
  }

  // ─── Desktop Layout ───
  return (
    <div style={styles.layout}>
      <div style={styles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} hideNavIcons={isMobile} />
      </div>
      <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
        <DMSidebar
          conversations={conversations}
          messageRequests={messageRequests}
          activeConversationId={conversationId || null}
          currentUserId={user?.id || ''}
          user={user}
          dmUnreads={dmUnreads}
        />
      </div>
      <div style={styles.main}>
        {!channelSidebarOpen && (
          <div style={styles.expandBar}>
            <button onClick={toggleChannelSidebar} style={styles.expandBtn} title="Show conversations">
              <PanelLeft size={18} />
            </button>
          </div>
        )}
        {chatWithPanels || (
          <div style={styles.placeholder}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              Select a conversation to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DM Header Content (1:1) ───

function DMHeaderContent({ otherParticipant, currentUserId }: { otherParticipant: any; currentUserId: string }) {
  const navigate = useNavigate();
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const followUser = useFollowsStore((s) => s.followUser);

  useEffect(() => {
    if (otherParticipant && otherParticipant.id !== currentUserId) {
      api<FollowStatus>(`/follows/status/${otherParticipant.id}`)
        .then(setFollowStatus)
        .catch(() => setFollowStatus(null));
    }
  }, [otherParticipant?.id, currentUserId]);

  const handleFollow = async () => {
    if (!otherParticipant) return;
    setFollowLoading(true);
    try {
      const result = await followUser(otherParticipant.id);
      setFollowStatus({
        isFollowing: result.status === 'accepted',
        isFollowedBy: followStatus?.isFollowedBy ?? false,
        followRequestPending: result.status === 'pending',
        incomingRequestPending: followStatus?.incomingRequestPending ?? false,
      });
    } catch {
      // ignore
    }
    setFollowLoading(false);
  };

  return (
    <>
      <Avatar
        src={otherParticipant?.avatarUrl || null}
        name={otherParticipant?.displayName || '?'}
        size={28}
      />
      <span
        style={{ ...styles.headerName, cursor: 'pointer' }}
        onClick={() => otherParticipant?.username && navigate(`/p/${otherParticipant.username}`)}
        title="View profile"
      >{otherParticipant?.displayName}</span>
      <span style={styles.headerStatus}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: otherParticipant?.status === 'online' ? 'var(--success)' :
                     otherParticipant?.status === 'idle' ? '#faa61a' :
                     otherParticipant?.status === 'dnd' ? 'var(--danger)' : 'var(--text-muted)',
          display: 'inline-block',
        }} />
        {otherParticipant?.status}
      </span>
      <div style={{ flex: 1 }} />
      {followStatus && !followStatus.isFollowing && !followStatus.followRequestPending && (
        <button
          onClick={handleFollow}
          disabled={followLoading}
          style={styles.headerFriendBtn}
          title="Follow"
        >
          <UserPlus size={16} />
        </button>
      )}
      {followStatus?.followRequestPending && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={14} /> Request Sent
        </span>
      )}
    </>
  );
}

// ─── Group DM Header Content ───

function GroupDMHeaderContent({ conversation, currentUserId }: { conversation: Conversation; currentUserId: string }) {
  const navigate = useNavigate();
  const leaveGroup = useDMStore((s) => s.leaveGroup);
  const renameGroup = useDMStore((s) => s.renameGroup);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);

  const handleLeave = async () => {
    if (confirm('Leave this group?')) {
      await leaveGroup(conversation.id);
      navigate('/dm');
    }
  };

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== conversation.name) {
      await renameGroup(conversation.id, trimmed);
    }
    setRenaming(false);
  };

  return (
    <>
      <Users size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      {renaming ? (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setRenaming(false);
          }}
          onBlur={handleRename}
          autoFocus
          style={styles.renameInput}
        />
      ) : (
        <span
          style={{ ...styles.headerName, cursor: 'pointer' }}
          onClick={() => { setNewName(conversation.name || ''); setRenaming(true); }}
          title="Click to rename"
        >
          {conversation.name}
        </span>
      )}
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {conversation.participants.length} members
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={() => { setNewName(conversation.name || ''); setRenaming(true); }} style={styles.headerFriendBtn} title="Rename group">
        <Pencil size={15} />
      </button>
      {conversation.participants.length < 10 && (
        <button onClick={() => setShowAddMembers(true)} style={styles.headerFriendBtn} title="Add members">
          <UserPlus size={16} />
        </button>
      )}
      <button onClick={handleLeave} style={{ ...styles.headerFriendBtn, color: 'var(--danger, #ed4245)' }} title="Leave group">
        <LeaveIcon size={16} />
      </button>
      {showAddMembers && (
        <AddMembersModal
          conversation={conversation}
          onClose={() => setShowAddMembers(false)}
        />
      )}
    </>
  );
}

// ─── Group Members Panel ───

function GroupMembersPanel({
  conversation,
  currentUserId,
  onMessage,
  onClose,
}: {
  conversation: Conversation;
  currentUserId: string;
  onMessage: (userId: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const owner = conversation.ownerId;
  const sorted = [...conversation.participants].sort((a, b) => {
    // Owner first, then online status, then alphabetical
    if (a.id === owner) return -1;
    if (b.id === owner) return 1;
    const statusOrder = { online: 0, idle: 1, dnd: 2, offline: 3 };
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div style={groupMembersPanelStyles.container}>
      <div style={groupMembersPanelStyles.header}>
        <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Members — {conversation.participants.length}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
      <div style={groupMembersPanelStyles.list}>
        {sorted.map((p) => (
          <div
            key={p.id}
            style={groupMembersPanelStyles.member}
            onClick={() => {
              if (p.id !== currentUserId) navigate(`/p/${p.username}`);
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar src={p.avatarUrl} name={p.displayName} size={32} baseColor={p.baseColor} accentColor={p.accentColor} />
              <span style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 10, height: 10, borderRadius: '50%',
                border: '2px solid var(--bg-secondary)',
                background: p.status === 'online' ? 'var(--success, #3ba55d)' :
                           p.status === 'idle' ? '#faa61a' :
                           p.status === 'dnd' ? 'var(--danger, #ed4245)' : 'var(--text-muted)',
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                {p.displayName}
                {p.id === owner && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700 }}>OWNER</span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{p.username}
              </div>
            </div>
            {p.id !== currentUserId && (
              <button
                onClick={(e) => { e.stopPropagation(); onMessage(p.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                title="Message"
              >
                <Forward size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const groupMembersPanelStyles: Record<string, React.CSSProperties> = {
  container: {
    width: 240,
    flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 12px 8px',
    borderBottom: '1px solid var(--border)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  member: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
};

// ─── Conversation List Item (with context menu) ───

function ConversationListItem({
  conversation: conv,
  isActive,
  hasUnread,
  unreadCount,
  currentUserId,
}: {
  conversation: Conversation;
  isActive: boolean;
  hasUnread: boolean;
  unreadCount: number;
  currentUserId: string;
}) {
  const navigate = useNavigate();
  const { muteConversation, unmuteConversation, deleteConversation, leaveGroup } = useDMStore();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const isGroup = conv.type === 'group';
  const other = !isGroup ? conv.participants.find((p) => p.id !== currentUserId) : null;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const contextItems: ContextMenuItem[] = [
    {
      label: conv.muted ? 'Unmute' : 'Mute',
      icon: conv.muted ? <Bell size={14} /> : <BellOff size={14} />,
      onClick: () => conv.muted ? unmuteConversation(conv.id) : muteConversation(conv.id),
    },
    ...(isGroup ? [{
      label: 'Leave Group',
      icon: <LeaveIcon size={14} />,
      danger: true,
      onClick: async () => {
        if (confirm('Leave this group?')) {
          await leaveGroup(conv.id);
          navigate('/dm');
        }
      },
    }] : [{
      label: 'Delete Conversation',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: async () => {
        if (confirm('Delete this conversation? All messages will be permanently removed.')) {
          await deleteConversation(conv.id);
          navigate('/dm');
        }
      },
    }]),
  ];

  return (
    <>
      <button
        onClick={() => navigate(`/dm/${conv.id}`)}
        onContextMenu={handleContextMenu}
        style={{
          ...styles.convItem,
          background: isActive ? 'var(--hover)' : 'transparent',
        }}
      >
        {isGroup ? (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <Avatar src={other?.avatarUrl ?? null} name={other?.displayName || '?'} size={32} dimmed={other?.status === 'offline'} baseColor={other?.baseColor} accentColor={other?.accentColor} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: (isActive || hasUnread) ? 700 : 600,
            color: (isActive || hasUnread) ? 'var(--text-primary)' : 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {isGroup ? conv.name : other?.displayName}
            {conv.muted && <BellOff size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          </div>
          {conv.lastMessage ? (
            <div style={{
              fontSize: '0.75rem',
              color: hasUnread ? 'var(--text-secondary)' : 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {conv.lastMessage.content}
            </div>
          ) : isGroup ? (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {conv.participants.length} members
            </div>
          ) : null}
        </div>
        {hasUnread && !conv.muted && (
          <span style={styles.unreadBadge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={contextItems} onClose={() => setCtxMenu(null)} />
      )}
    </>
  );
}

// ─── DM Sidebar ───

function DMSidebar({
  conversations,
  messageRequests,
  activeConversationId,
  currentUserId,
  user,
  dmUnreads,
}: {
  conversations: Conversation[];
  messageRequests: Conversation[];
  activeConversationId: string | null;
  currentUserId: string;
  user: any;
  dmUnreads: Record<string, number>;
}) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const toggleChannelSidebar = useLayoutStore((s) => s.toggleChannelSidebar);
  const [tab, setTab] = useState<'messages' | 'following'>('messages');
  const [showGroupModal, setShowGroupModal] = useState(false);

  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setTab('messages')}
            style={{
              ...styles.tabBtn,
              color: tab === 'messages' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === 'messages' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            Messages
          </button>
          <button
            onClick={() => setTab('following')}
            style={{
              ...styles.tabBtn,
              color: tab === 'following' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === 'following' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            Following
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {tab === 'messages' && (
            <button onClick={() => setShowGroupModal(true)} style={styles.collapseBtn} title="New Group DM">
              <Users size={16} />
            </button>
          )}
          <button onClick={toggleChannelSidebar} style={styles.collapseBtn} title="Collapse sidebar">
            <PanelLeftClose size={18} />
          </button>
        </div>
      </div>

      {tab === 'messages' ? (
        <div style={styles.convList}>
          {/* Message Requests */}
          {messageRequests.length > 0 && (
            <>
              <div style={styles.sidebarSectionLabel}>Message Requests — {messageRequests.length}</div>
              {messageRequests.map((conv) => (
                <MessageRequestItem key={conv.id} conversation={conv} currentUserId={currentUserId} />
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            </>
          )}

          {conversations.length === 0 && messageRequests.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No conversations yet
            </div>
          )}

          {conversations.map((conv) => {
            const unreadCount = dmUnreads[conv.id] || 0;
            const hasUnread = unreadCount > 0;

            return (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                hasUnread={hasUnread}
                unreadCount={unreadCount}
                currentUserId={currentUserId}
              />
            );
          })}
        </div>
      ) : (
        <FollowingTab currentUserId={currentUserId} />
      )}

      {/* User bar */}
      <div style={styles.userBar}>
        <Avatar src={user?.avatarUrl || null} name={user?.displayName || '?'} size={28} baseColor={user?.baseColor} accentColor={user?.accentColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.displayName}
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn} title="Sign out"><LogOut size={16} /></button>
      </div>

      {showGroupModal && (
        <CreateGroupDMModal onClose={() => setShowGroupModal(false)} />
      )}
    </div>
  );
}

// ─── Message Request Item ───

function MessageRequestItem({ conversation, currentUserId }: { conversation: Conversation; currentUserId: string }) {
  const acceptMessageRequest = useDMStore((s) => s.acceptMessageRequest);
  const declineMessageRequest = useDMStore((s) => s.declineMessageRequest);
  const [acting, setActing] = useState(false);

  const other = conversation.participants.find((p) => p.id !== currentUserId);
  if (!other) return null;

  return (
    <div style={styles.requestItem}>
      <Avatar src={other.avatarUrl} name={other.displayName} size={28} baseColor={other.baseColor} accentColor={other.accentColor} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {other.displayName}
        </div>
      </div>
      <button
        onClick={async () => { setActing(true); await acceptMessageRequest(conversation.id); }}
        disabled={acting}
        style={styles.acceptBtn}
        title="Accept"
      >
        <Check size={14} />
      </button>
      <button
        onClick={async () => { setActing(true); await declineMessageRequest(conversation.id); }}
        disabled={acting}
        style={styles.declineBtn}
        title="Decline"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Following Tab ───

function FollowingTab({ currentUserId }: { currentUserId: string }) {
  const navigate = useNavigate();
  const {
    following,
    pendingRequests,
    fetchFollowing,
    fetchPendingRequests,
    acceptFollowRequest,
    declineFollowRequest,
    unfollowUser,
  } = useFollowsStore();
  const createConversation = useDMStore((s) => s.createConversation);

  useEffect(() => {
    fetchFollowing(currentUserId);
    fetchPendingRequests();
  }, [fetchFollowing, fetchPendingRequests, currentUserId]);

  const handleMessage = async (userId: string) => {
    try {
      const conv = await createConversation(userId);
      navigate(`/dm/${conv.id}`);
    } catch {
      // ignore
    }
  };

  return (
    <div style={styles.convList}>
      {pendingRequests.length > 0 && (
        <>
          <div style={styles.sidebarSectionLabel}>Pending Requests — {pendingRequests.length}</div>
          {pendingRequests.map((req) => (
            <div key={req.id} style={styles.requestItem}>
              <Avatar src={req.avatarUrl || null} name={req.displayName || '?'} size={28} baseColor={req.baseColor} accentColor={req.accentColor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {req.displayName}
                </div>
              </div>
              <button onClick={() => acceptFollowRequest(req.id)} style={styles.acceptBtn} title="Accept">
                <Check size={14} />
              </button>
              <button onClick={() => declineFollowRequest(req.id)} style={styles.declineBtn} title="Decline">
                <X size={14} />
              </button>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        </>
      )}

      {following.length === 0 && pendingRequests.length === 0 && (
        <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
          Not following anyone yet
        </div>
      )}

      {following.map((f) => (
        <div key={f.id} style={styles.friendItem}>
          <Avatar src={f.avatarUrl || null} name={f.displayName || '?'} size={32} baseColor={f.baseColor} accentColor={f.accentColor} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.displayName}
            </div>
          </div>
          <button onClick={() => handleMessage(f.id)} style={styles.friendMsgBtn} title="Message">
            Message
          </button>
          <button onClick={() => { if (confirm('Unfollow this user?')) unfollowUser(f.id); }} style={styles.friendRemoveBtn} title="Unfollow">
            <UserMinus size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Create Group DM Modal ───

function CreateGroupDMModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { following, fetchFollowing } = useFollowsStore();
  const createGroupDM = useDMStore((s) => s.createGroupDM);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user?.id) fetchFollowing(user.id);
  }, [fetchFollowing, user?.id]);

  const toggleFriend = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < 9) next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    try {
      const conv = await createGroupDM(
        Array.from(selected),
        groupName.trim() || undefined,
      );
      onClose();
      navigate(`/dm/${conv.id}`);
    } catch {
      // ignore
    }
    setCreating(false);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Create Group DM</h3>

        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name (optional)"
          style={styles.modalInput}
        />

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 4px' }}>
          Select users ({selected.size}/9)
        </div>

        <div style={styles.friendPickerList}>
          {following.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Follow users first to create a group
            </div>
          )}
          {following.map((f) => {
            const uid = f.id;
            if (!uid) return null;
            const isSelected = selected.has(uid);
            return (
              <button
                key={f.id}
                onClick={() => toggleFriend(uid)}
                style={{
                  ...styles.friendPickerItem,
                  background: isSelected ? 'var(--hover)' : 'transparent',
                }}
              >
                <Avatar src={f.avatarUrl || null} name={f.displayName || '?'} size={28} baseColor={f.baseColor} accentColor={f.accentColor} />
                <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {f.displayName}
                </span>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: isSelected ? 'none' : '2px solid var(--text-muted)',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <Check size={12} style={{ color: 'white' }} />}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={styles.modalCancelBtn}>Cancel</button>
          <button onClick={handleCreate} disabled={creating || selected.size === 0} style={styles.modalCreateBtn}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Members Modal ───

function AddMembersModal({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const addMembers = useDMStore((s) => s.addMembers);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const existingIds = new Set(conversation.participants.map((p) => p.id));
  const maxNew = 10 - conversation.participants.length;

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    try {
      const data = await api<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data.filter((u) => !existingIds.has(String(u.id))));
    } catch { setResults([]); }
  }, [existingIds]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setError('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 300);
  };

  const toggleUser = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < maxNew) next.add(userId);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setError('');
    try {
      await addMembers(conversation.id, Array.from(selected));
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add members');
    }
    setAdding(false);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Add Members</h3>

        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search users..."
          autoFocus
          style={styles.modalInput}
        />

        {selected.size > 0 && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 4px' }}>
            {selected.size} selected (max {maxNew} new)
          </div>
        )}

        <div style={styles.friendPickerList}>
          {query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No users found
            </div>
          )}
          {results.map((u) => {
            const isSelected = selected.has(String(u.id));
            return (
              <button
                key={u.id}
                onClick={() => toggleUser(String(u.id))}
                style={{
                  ...styles.friendPickerItem,
                  background: isSelected ? 'var(--hover)' : 'transparent',
                }}
              >
                <Avatar src={u.avatarUrl} name={u.displayName} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{u.displayName}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>@{u.username}</span>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: isSelected ? 'none' : '2px solid var(--text-muted)',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <Check size={12} style={{ color: 'white' }} />}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ color: 'var(--danger, #ed4245)', fontSize: '0.82rem', marginTop: 8 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={styles.modalCancelBtn}>Cancel</button>
          <button onClick={handleAdd} disabled={adding || selected.size === 0} style={styles.modalCreateBtn}>
            {adding ? 'Adding...' : `Add ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DM Message List ───

function DMMessageList({
  messages,
  loading,
  hasMore,
  currentUserId,
  conversationId,
  onLoadMore,
}: {
  messages: DirectMessage[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string;
  conversationId: string;
  onLoadMore: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const [reportTarget, setReportTarget] = useState<{ message: DirectMessage } | null>(null);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 100) {
      onLoadMore();
    }
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} style={styles.messageContainer}>
      {loading && messages.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading messages...</div>
      )}

      {hasMore && messages.length > 0 && (
        <button onClick={onLoadMore} style={styles.loadMore}>
          {loading ? 'Loading...' : 'Load older messages'}
        </button>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const prevHasEmbed = prev && ((prev.embeds && prev.embeds.length > 0) || (prev.attachments && prev.attachments.length > 0));
        const sameAuthor = prev?.authorId === msg.authorId && !prevHasEmbed;
        const gap = sameAuthor && prev ? snowflakeTime(msg.id) - snowflakeTime(prev.id) : Infinity;
        const compact = sameAuthor && gap < 60000;
        const spacedSameAuthor = sameAuthor && gap >= 60000 && gap < 900000;
        return (
          <DMMessageItem
            key={msg.id}
            message={msg}
            compact={compact}
            spacedSameAuthor={spacedSameAuthor}
            isOwn={msg.authorId === currentUserId}
            currentUserId={currentUserId}
            conversationId={conversationId}
            onReport={(m) => setReportTarget({ message: m })}
          />
        );
      })}

      <div ref={bottomRef} />

      {reportTarget && (
        <ReportModal
          reportedUserId={reportTarget.message.authorId}
          reportedUsername={reportTarget.message.author?.displayName || 'Unknown'}
          dmMessageId={reportTarget.message.id}
          conversationId={conversationId}
          messagePreview={reportTarget.message.content}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

// ─── DM Message Item ───

function DMMessageItem({
  message,
  compact,
  spacedSameAuthor,
  isOwn,
  currentUserId,
  conversationId,
  onReport,
}: {
  message: DirectMessage;
  compact: boolean;
  spacedSameAuthor?: boolean;
  isOwn: boolean;
  currentUserId: string;
  conversationId: string;
  onReport: (msg: DirectMessage) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const editMessage = useDMStore((s) => s.editMessage);
  const deleteMessage = useDMStore((s) => s.deleteMessage);
  const toggleReaction = useDMStore((s) => s.toggleReaction);
  const blockUser = useBlocksStore((s) => s.blockUser);
  const isBlockedByMe = useBlocksStore((s) => s.isBlockedByMe);
  const unblockUser = useBlocksStore((s) => s.unblockUser);
  const ts = formatTimestamp(message.id);

  const handleReaction = (emoji: string) => {
    const hasReacted = message.reactions?.some(
      (r) => r.emoji === emoji && r.users.some((u) => u.id === currentUserId),
    ) || false;
    toggleReaction(conversationId, message.id, emoji, hasReacted);
    setShowEmojiPicker(false);
  };

  const handleEdit = () => {
    setEditContent(message.content);
    setEditing(true);
  };

  const handleEditSave = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    await editMessage(conversationId, message.id, trimmed);
    setEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      deleteMessage(conversationId, message.id);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLongPressCallback = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setContextMenu({ x: touch.clientX, y: touch.clientY });
  }, []);

  const longPressHandlers = useLongPress(handleLongPressCallback);

  const navigate = useNavigate();

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    const match = href.match(/\/(?:space\/\d+\/channel\/\d+|dm\/\d+)\/message\/\d+/);
    if (match) {
      e.preventDefault();
      try {
        const url = new URL(href, window.location.origin);
        navigate(url.pathname);
      } catch {
        navigate(href);
      }
    }
  }, [navigate]);

  const blocked = !isOwn && isBlockedByMe(message.authorId);

  const handleBlock = async () => {
    if (blocked) {
      await unblockUser(message.authorId);
    } else if (confirm(`Block ${message.author?.displayName || 'this user'}? They won't be able to message you.`)) {
      await blockUser(message.authorId);
    }
  };

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Add Reaction', icon: <SmilePlus size={16} />, onClick: () => setShowEmojiPicker(true) },
    { label: 'Copy Text', icon: <Copy size={16} />, onClick: () => navigator.clipboard.writeText(message.content) },
    { label: 'Copy Link', icon: <Link2 size={16} />, onClick: () => navigator.clipboard.writeText(`${window.location.origin}/dm/${conversationId}/message/${message.id}`) },
    { label: 'Share', icon: <Forward size={16} />, onClick: () => setShowSharePicker(true) },
    ...(isOwn ? [{ label: 'Edit', icon: <Pencil size={16} />, onClick: handleEdit }] : []),
    ...(!isOwn ? [{ label: 'Report', icon: <Flag size={16} />, onClick: () => onReport(message) }] : []),
    ...(!isOwn ? [{ label: blocked ? 'Unblock' : 'Block', icon: <Ban size={16} />, danger: !blocked, onClick: handleBlock }] : []),
    ...(isOwn ? [{ label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: handleDelete }] : []),
  ];

  return (
    <>
    <div
      style={{ ...styles.message, marginTop: compact ? 1 : spacedSameAuthor ? 6 : 10, paddingTop: compact ? 1 : 0 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={handleContextMenu}
      {...longPressHandlers}
    >
      {showActions && !editing && (
        <div style={styles.actionBar}>
          <button style={styles.actionBtn} title="Add reaction" onClick={() => setShowEmojiPicker(!showEmojiPicker)}><SmilePlus size={16} /></button>
          <button style={styles.actionBtn} title="Share" onClick={() => setShowSharePicker(true)}><Forward size={16} /></button>
          {isOwn && <button style={styles.actionBtn} title="Edit" onClick={handleEdit}><Pencil size={16} /></button>}
          {isOwn && <button style={styles.actionBtn} title="Delete" onClick={handleDelete}><Trash2 size={16} /></button>}
        </div>
      )}

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            handleReaction(emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}

      {!compact && !spacedSameAuthor && (
        <div style={styles.messageHeader}>
          <Avatar src={message.author?.avatarUrl || null} name={message.author?.displayName || '?'} size={32} baseColor={message.author?.baseColor} accentColor={message.author?.accentColor} />
          <span style={styles.username}>{message.author?.displayName || 'Unknown'}</span>
          <span style={styles.timestamp}>{ts}</span>
          {message.editedAt && <span style={styles.edited}>(edited)</span>}
        </div>
      )}

      <div style={{ paddingLeft: 44, lineHeight: 1.3, marginTop: -6 }} onClick={handleContentClick}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              style={styles.editTextarea}
              autoFocus
              rows={2}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esc to cancel, Enter to save</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setEditing(false)} style={styles.editCancelBtn}>Cancel</button>
                <button onClick={handleEditSave} style={styles.editSaveBtn}>Save</button>
              </div>
            </div>
          </div>
        ) : (
          <MessageEmbeds content={message.content} embeds={message.embeds} />
        )}
      </div>

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <MessageAttachments attachments={message.attachments} />
      )}

      {/* Reactions */}
      <ReactionBar
        reactions={message.reactions}
        currentUserId={currentUserId}
        onToggleReaction={handleReaction}
      />
    </div>
    {showSharePicker && (
      <ShareToSpacePicker
        contentType="post"
        itemId={message.id}
        onClose={() => setShowSharePicker(false)}
        onShared={() => setShowSharePicker(false)}
        onShareToChannel={async (targetChannelId) => {
          const link = `${window.location.origin}/dm/${conversationId}/message/${message.id}`;
          await api(`/channels/${targetChannelId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: link }),
          });
        }}
        onShareToDM={async (targetConversationId) => {
          const link = `${window.location.origin}/dm/${conversationId}/message/${message.id}`;
          await api(`/conversations/${targetConversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: link }),
          });
        }}
      />
    )}
    </>
  );
}

// ─── DM Input ───

function DMInput({ conversationId, onSend, onSendWithFiles }: {
  conversationId: string;
  onSend: (convId: string, content: string) => Promise<void>;
  onSendWithFiles: (convId: string, content: string, files: File[]) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emitTyping = useDMTypingEmit(conversationId);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && files.length === 0) return;
    const currentFiles = [...files];
    setContent('');
    setFiles([]);
    if (currentFiles.length > 0) {
      await onSendWithFiles(conversationId, trimmed, currentFiles);
    } else {
      await onSend(conversationId, trimmed);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={styles.inputContainer}>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {files.map((file, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2px 8px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px 0', lineHeight: 1, flexShrink: 0 }}
          title="Attach files"
        >
          <Paperclip size={20} />
        </button>
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileSelect} />
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); emitTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type a message..."
          style={{ ...styles.textarea, flex: 1 }}
          rows={1}
        />
      </div>
    </div>
  );
}

// ─── Helpers ───

const EPOCH = 1735689600000;

function snowflakeTime(id: string): number {
  try { return Number(BigInt(id) >> 22n) + EPOCH; } catch { return 0; }
}

function formatTimestamp(snowflakeId: string): string {
  try {
    const id = BigInt(snowflakeId);
    const timestamp = Number(id >> 22n) + EPOCH;
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ─── Styles ───

const mobileLayout: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 56,
  display: 'flex',
  overflow: 'hidden',
  background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))',
};

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebar: {
    width: '100%',
    height: '100%',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '12px 12px 8px',
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '4px 8px',
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    borderRadius: 'var(--radius)',
  },
  sidebarWrap: {
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    height: '100%',
  },
  expandBar: {
    display: 'flex',
    gap: 2,
    padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
  },
  convList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  sidebarSectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '4px 8px',
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  unreadBadge: {
    background: 'var(--danger)',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 10,
    flexShrink: 0,
  },
  requestItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    borderRadius: 'var(--radius)',
  },
  acceptBtn: {
    background: 'var(--success)',
    border: 'none',
    color: 'white',
    padding: '4px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  declineBtn: {
    background: 'var(--danger)',
    border: 'none',
    color: 'white',
    padding: '4px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 'var(--radius)',
  },
  friendMsgBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '3px 8px',
    borderRadius: 'var(--radius)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  friendRemoveBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '3px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  userBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.15)',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.2rem',
    padding: '2px 6px',
    borderRadius: 4,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  headerName: {
    fontWeight: 700,
    fontSize: '1rem',
  },
  headerStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  headerFriendBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
  },
  renameInput: {
    background: 'var(--bg-input)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontSize: '1rem',
    padding: '2px 8px',
    outline: 'none',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 16px',
    display: 'flex',
    flexDirection: 'column',
  },
  loadMore: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    padding: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  message: {
    position: 'relative',
    padding: '2px 8px',
    borderRadius: 'var(--radius)',
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
  },
  username: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
  edited: {
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
  },
  actionBar: {
    position: 'absolute',
    right: 8,
    top: -12,
    display: 'flex',
    gap: 2,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '2px 4px',
    zIndex: 10,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: '0.85rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  editTextarea: {
    width: '100%',
    padding: '8px',
    background: 'var(--bg-input)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.4,
  },
  editCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '2px 8px',
  },
  editSaveBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '3px 10px',
    borderRadius: 4,
    fontWeight: 600,
  },
  typingBar: {
    height: 20,
    padding: '0 16px',
    flexShrink: 0,
  },
  inputContainer: {
    padding: '0 16px 16px',
    flexShrink: 0,
  },
  textarea: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    resize: 'none',
    lineHeight: 1.4,
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    width: 360,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  modalInput: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  friendPickerList: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 300,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    margin: '4px 0',
  },
  friendPickerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  modalCancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '6px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  modalCreateBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '6px 16px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
};
