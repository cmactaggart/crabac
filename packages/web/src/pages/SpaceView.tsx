import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronsRight, PanelLeft } from 'lucide-react';
import { useSpacesStore } from '../stores/spaces.js';
import { useChannelsStore } from '../stores/channels.js';
import { useMessagesStore } from '../stores/messages.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { getSocket } from '../lib/socket.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ChannelSidebar } from '../components/layout/ChannelSidebar.js';
import { MembersPanel } from '../components/layout/MembersPanel.js';
import { MessageArea } from '../components/messages/MessageArea.js';
import { ForumChannelView } from '../components/forums/ForumChannelView.js';
import { CalendarView } from '../components/calendar/CalendarView.js';

export function SpaceView() {
  const { spaceId, channelId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { spaceSidebarOpen, channelSidebarOpen, membersSidebarOpen, calendarOpen, mobileView, setMobileView, setCalendarOpen, toggleSpaceSidebar, toggleChannelSidebar } = useLayoutStore();
  const { spaces, fetchSpaces, setActiveSpace, members, fetchMembers, updateMemberStatus } = useSpacesStore();
  const { channels, categories, fetchChannels, fetchCategories, fetchUnreads, fetchMuted, setActiveChannel } = useChannelsStore();

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    if (spaceId) {
      useChannelsStore.setState({ channels: [], categories: [], activeChannelId: null });
      useMessagesStore.getState().clearMessages();
      setActiveSpace(spaceId);
      fetchChannels(spaceId);
      fetchCategories(spaceId);
      fetchUnreads(spaceId);
      fetchMuted(spaceId);
    }
  }, [spaceId, setActiveSpace, fetchChannels, fetchCategories, fetchUnreads, fetchMuted]);

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
      setCalendarOpen(false);
      if (isMobile) setMobileView('chat');
    } else if (!isMobile && !useLayoutStore.getState().calendarOpen && channels.length > 0 && spaceId && channels[0].spaceId === spaceId) {
      const firstRegular = channels.find((c) => !c.isAdmin) || channels[0];
      navigate(`/space/${spaceId}/channel/${firstRegular.id}`, { replace: true });
    }
  }, [channelId, channels, spaceId, navigate, setActiveChannel, setCalendarOpen, isMobile, setMobileView]);

  // Listen for member presence and membership changes
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !spaceId) return;

    const onPresence = ({ userId, status }: { userId: string; status: string }) => {
      updateMemberStatus(userId, status);
    };
    const onMemberChange = () => {
      fetchMembers(spaceId);
    };
    const onReconnect = () => {
      fetchMembers(spaceId);
    };

    socket.on('member:presence', onPresence);
    socket.on('space:member_joined', onMemberChange);
    socket.on('space:member_left', onMemberChange);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('member:presence', onPresence);
      socket.off('space:member_joined', onMemberChange);
      socket.off('space:member_left', onMemberChange);
      socket.off('connect', onReconnect);
    };
  }, [spaceId, updateMemberStatus, fetchMembers]);

  // Close members panel when switching to mobile
  useEffect(() => {
    if (isMobile && membersSidebarOpen) {
      useLayoutStore.getState().toggleMembersSidebar();
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSpace = spaces.find((s) => s.id === spaceId);

  // ─── Mobile Layout ───
  if (isMobile) {
    const showChat = channelId && mobileView === 'chat';

    const activeChannel = channels.find((c) => c.id === channelId) || null;

    if (calendarOpen && mobileView === 'chat' && spaceId) {
      return (
        <div style={{ ...styles.layout, paddingBottom: 56 }}>
          <CalendarView
            spaceId={spaceId}
            showBackButton
            onBack={() => {
              setCalendarOpen(false);
              setMobileView('sidebar');
            }}
          />
        </div>
      );
    }

    if (showChat && spaceId) {
      return (
        <div style={{ ...styles.layout, paddingBottom: 56 }}>
          {activeChannel?.type === 'forum' ? (
            <ForumChannelView
              channelId={channelId}
              channel={activeChannel}
              spaceId={spaceId}
              showBackButton
              onBack={() => {
                setMobileView('sidebar');
                navigate(`/space/${spaceId}`, { replace: true });
              }}
            />
          ) : (
            <MessageArea
              channelId={channelId}
              channel={activeChannel}
              spaceId={spaceId}
              showBackButton
              onBack={() => {
                setMobileView('sidebar');
                navigate(`/space/${spaceId}`, { replace: true });
              }}
            />
          )}
          {membersSidebarOpen && (
            <MembersPanel members={members} spaceId={spaceId} asOverlay />
          )}
        </div>
      );
    }

    return (
      <div style={{ ...styles.layout, paddingBottom: 56 }}>
        <div style={{ width: 72, flexShrink: 0, height: '100%' }}>
          <SpaceSidebar spaces={spaces} activeSpaceId={spaceId || null} />
        </div>
        <ChannelSidebar
          space={activeSpace || null}
          channels={channels}
          categories={categories}
          activeChannelId={channelId || null}
          fullWidth
        />
      </div>
    );
  }

  // ─── Desktop Layout ───
  return (
    <div style={styles.layout}>
      <div style={{ ...styles.sidebarWrap, width: spaceSidebarOpen ? 72 : 0 }}>
        <SpaceSidebar spaces={spaces} activeSpaceId={spaceId || null} />
      </div>
      <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
        <ChannelSidebar
          space={activeSpace || null}
          channels={channels}
          categories={categories}
          activeChannelId={channelId || null}
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
              <button onClick={toggleChannelSidebar} style={styles.expandBtn} title="Show channels">
                <PanelLeft size={18} />
              </button>
            )}
          </div>
        )}
        {calendarOpen && spaceId ? (
          <CalendarView spaceId={spaceId} />
        ) : channelId && spaceId ? (
          channels.find((c) => c.id === channelId)?.type === 'forum' ? (
            <ForumChannelView
              channelId={channelId}
              channel={channels.find((c) => c.id === channelId) || null}
              spaceId={spaceId}
            />
          ) : (
            <MessageArea
              channelId={channelId}
              channel={channels.find((c) => c.id === channelId) || null}
              spaceId={spaceId}
            />
          )
        ) : (
          <div style={styles.placeholder}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              Select a channel to start chatting
            </p>
          </div>
        )}
      </div>
      <div style={{ ...styles.sidebarWrap, width: membersSidebarOpen ? 240 : 0 }}>
        <MembersPanel members={members} spaceId={spaceId} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebarWrap: {
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    height: '100%',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
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
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
