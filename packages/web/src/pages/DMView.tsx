import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Copy, Link2, Pencil, Trash2, PanelLeftClose, ChevronsRight, PanelLeft, UserPlus, Users, LogOut as LeaveIcon, Check, X, Clock, UserMinus, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useDMStore } from '../stores/dm.js';
import { useFriendsStore } from '../stores/friends.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useDMSocket, useDMTypingEmit } from '../hooks/useDMSocket.js';
import { useFriendsSocket } from '../hooks/useFriendsSocket.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { Avatar } from '../components/common/Avatar.js';
import { Markdown } from '../components/common/Markdown.js';
import { MessageLinkEmbed, extractMessageLinks } from '../components/messages/MessageLinkEmbed.js';
import { ContextMenu, useLongPress, type ContextMenuItem } from '../components/common/ContextMenu.js';
import { api } from '../lib/api.js';
import type { DirectMessage, Conversation, FriendshipStatus } from '@crabac/shared';

export function DMView() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const { spaceSidebarOpen, channelSidebarOpen, mobileView, setMobileView, toggleSpaceSidebar, toggleChannelSidebar } = useLayoutStore();
  const { spaces, fetchSpaces } = useSpacesStore();
  const {
    conversations,
    messageRequests,
    messages,
    loading,
    hasMore,
    typingUsers,
    dmUnreads,
    fetchConversations,
    fetchMessageRequests,
    fetchDMUnreads,
    openConversation,
    fetchMessages,
    sendMessage,
    clearMessages,
  } = useDMStore();

  useDMSocket(conversationId || null);
  useFriendsSocket();

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
      <DMInput conversationId={conversationId} onSend={sendMessage} />
    </div>
  ) : null;

  // ─── Mobile Layout ───
  if (isMobile) {
    const showChat = conversationId && mobileView === 'chat' && activeConv;

    if (showChat) {
      return (
        <div style={{ ...styles.layout, paddingBottom: 56 }}>
          {chatContent}
        </div>
      );
    }

    return (
      <div style={{ ...styles.layout, paddingBottom: 56 }}>
        <div style={{ width: 72, flexShrink: 0, height: '100%' }}>
          <SpaceSidebar spaces={spaces} activeSpaceId={null} />
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
      <div style={{ ...styles.sidebarWrap, width: spaceSidebarOpen ? 72 : 0 }}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
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
        {(!spaceSidebarOpen || !channelSidebarOpen) && (
          <div style={styles.expandBar}>
            {!spaceSidebarOpen && (
              <button onClick={toggleSpaceSidebar} style={styles.expandBtn} title="Show spaces">
                <ChevronsRight size={18} />
              </button>
            )}
            {!channelSidebarOpen && (
              <button onClick={toggleChannelSidebar} style={styles.expandBtn} title="Show conversations">
                <PanelLeft size={18} />
              </button>
            )}
          </div>
        )}
        {chatContent || (
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
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus | null | undefined>(undefined);
  const [friendLoading, setFriendLoading] = useState(false);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);

  useEffect(() => {
    if (otherParticipant && otherParticipant.id !== currentUserId) {
      api<FriendshipStatus | null>(`/friends/status/${otherParticipant.id}`)
        .then(setFriendStatus)
        .catch(() => setFriendStatus(null));
    }
  }, [otherParticipant?.id, currentUserId]);

  const handleSendRequest = async () => {
    if (!otherParticipant) return;
    setFriendLoading(true);
    try {
      await sendFriendRequest(otherParticipant.id);
      setFriendStatus({ id: '', status: 'pending', direction: 'sent' });
    } catch {
      // ignore
    }
    setFriendLoading(false);
  };

  return (
    <>
      <Avatar
        src={otherParticipant?.avatarUrl || null}
        name={otherParticipant?.displayName || '?'}
        size={28}
      />
      <span style={styles.headerName}>{otherParticipant?.displayName}</span>
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
      {friendStatus !== undefined && !friendStatus && (
        <button
          onClick={handleSendRequest}
          disabled={friendLoading}
          style={styles.headerFriendBtn}
          title="Send Friend Request"
        >
          <UserPlus size={16} />
        </button>
      )}
      {friendStatus?.status === 'pending' && friendStatus.direction === 'sent' && (
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
      <button onClick={handleLeave} style={styles.headerFriendBtn} title="Leave group">
        <LeaveIcon size={16} />
      </button>
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
  const [tab, setTab] = useState<'messages' | 'friends'>('messages');
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
            onClick={() => setTab('friends')}
            style={{
              ...styles.tabBtn,
              color: tab === 'friends' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === 'friends' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            Friends
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

            if (conv.type === 'group') {
              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/dm/${conv.id}`)}
                  style={{
                    ...styles.convItem,
                    background: conv.id === activeConversationId ? 'var(--hover)' : 'transparent',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: hasUnread ? 700 : 600,
                      color: (conv.id === activeConversationId || hasUnread) ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {conv.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {conv.participants.length} members
                    </div>
                  </div>
                  {hasUnread && (
                    <span style={styles.unreadBadge}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              );
            }

            const other = conv.participants.find((p: any) => p.id !== currentUserId);
            if (!other) return null;
            const isActive = conv.id === activeConversationId;

            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/dm/${conv.id}`)}
                style={{
                  ...styles.convItem,
                  background: isActive ? 'var(--hover)' : 'transparent',
                }}
              >
                <Avatar src={other.avatarUrl} name={other.displayName} size={32} dimmed={other.status === 'offline'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: (isActive || hasUnread) ? 700 : 600,
                    color: (isActive || hasUnread) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {other.displayName}
                  </div>
                  {conv.lastMessage && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: hasUnread ? 'var(--text-secondary)' : 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {conv.lastMessage.content}
                    </div>
                  )}
                </div>
                {hasUnread && (
                  <span style={styles.unreadBadge}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <FriendsTab currentUserId={currentUserId} />
      )}

      {/* User bar */}
      <div style={styles.userBar}>
        <Avatar src={user?.avatarUrl || null} name={user?.displayName || '?'} size={28} />
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
      <Avatar src={other.avatarUrl} name={other.displayName} size={28} />
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

// ─── Friends Tab ───

function FriendsTab({ currentUserId }: { currentUserId: string }) {
  const navigate = useNavigate();
  const {
    friends,
    pendingRequests,
    fetchFriends,
    fetchPendingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
  } = useFriendsStore();
  const createConversation = useDMStore((s) => s.createConversation);

  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
  }, [fetchFriends, fetchPendingRequests]);

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
              <Avatar src={req.user?.avatarUrl || null} name={req.user?.displayName || '?'} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {req.user?.displayName}
                </div>
              </div>
              <button onClick={() => acceptFriendRequest(req.id)} style={styles.acceptBtn} title="Accept">
                <Check size={14} />
              </button>
              <button onClick={() => declineFriendRequest(req.id)} style={styles.declineBtn} title="Decline">
                <X size={14} />
              </button>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        </>
      )}

      {friends.length === 0 && pendingRequests.length === 0 && (
        <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
          No friends yet
        </div>
      )}

      {friends.map((friend) => (
        <div key={friend.id} style={styles.friendItem}>
          <Avatar src={friend.user?.avatarUrl || null} name={friend.user?.displayName || '?'} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {friend.user?.displayName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{friend.user?.status}</div>
          </div>
          <button onClick={() => friend.user && handleMessage(friend.user.id)} style={styles.friendMsgBtn} title="Message">
            Message
          </button>
          <button onClick={() => { if (confirm('Remove this friend?')) removeFriend(friend.id); }} style={styles.friendRemoveBtn} title="Remove">
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
  const { friends, fetchFriends } = useFriendsStore();
  const createGroupDM = useDMStore((s) => s.createGroupDM);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

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
          Select friends ({selected.size}/9)
        </div>

        <div style={styles.friendPickerList}>
          {friends.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Add friends first to create a group
            </div>
          )}
          {friends.map((f) => {
            const uid = f.user?.id;
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
                <Avatar src={f.user?.avatarUrl || null} name={f.user?.displayName || '?'} size={28} />
                <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {f.user?.displayName}
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
        const sameAuthor = prev?.authorId === msg.authorId;
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
            conversationId={conversationId}
          />
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

// ─── DM Message Item ───

function DMMessageItem({
  message,
  compact,
  spacedSameAuthor,
  isOwn,
  conversationId,
}: {
  message: DirectMessage;
  compact: boolean;
  spacedSameAuthor?: boolean;
  isOwn: boolean;
  conversationId: string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const editMessage = useDMStore((s) => s.editMessage);
  const deleteMessage = useDMStore((s) => s.deleteMessage);
  const ts = formatTimestamp(message.id);

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
  const linkedMessageIds = extractMessageLinks(message.content);

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

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Copy Text', icon: <Copy size={16} />, onClick: () => navigator.clipboard.writeText(message.content) },
    { label: 'Copy Link', icon: <Link2 size={16} />, onClick: () => navigator.clipboard.writeText(`${window.location.origin}/dm/${conversationId}/message/${message.id}`) },
    ...(isOwn ? [{ label: 'Edit', icon: <Pencil size={16} />, onClick: handleEdit }] : []),
    ...(isOwn ? [{ label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: handleDelete }] : []),
  ];

  return (
    <div
      style={{ ...styles.message, marginTop: compact ? 1 : spacedSameAuthor ? 6 : 10, paddingTop: compact ? 1 : 0 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={handleContextMenu}
      {...longPressHandlers}
    >
      {showActions && !editing && isOwn && (
        <div style={styles.actionBar}>
          <button style={styles.actionBtn} title="Edit" onClick={handleEdit}><Pencil size={16} /></button>
          <button style={styles.actionBtn} title="Delete" onClick={handleDelete}><Trash2 size={16} /></button>
        </div>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}

      {!compact && !spacedSameAuthor && (
        <div style={styles.messageHeader}>
          <Avatar src={message.author?.avatarUrl || null} name={message.author?.displayName || '?'} size={32} />
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
          <>
            <Markdown content={message.content} />
            {linkedMessageIds.map((mid) => (
              <MessageLinkEmbed key={mid} messageId={mid} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── DM Input ───

function DMInput({ conversationId, onSend }: { conversationId: string; onSend: (convId: string, content: string) => Promise<void> }) {
  const [content, setContent] = useState('');
  const emitTyping = useDMTypingEmit(conversationId);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent('');
    await onSend(conversationId, trimmed);
  };

  return (
    <div style={styles.inputContainer}>
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
        style={styles.textarea}
        rows={1}
      />
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
