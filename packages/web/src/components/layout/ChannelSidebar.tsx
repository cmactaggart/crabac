import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ChevronDown, Hash, LogOut, PanelLeftClose, Settings, Shield, Zap, CheckCheck, BellOff, Bell, Link, Copy, Plus, SlidersHorizontal, FolderPlus, GripVertical, ArrowRightLeft } from 'lucide-react';
import { Permissions } from '@gud/shared';
import { useLayoutStore } from '../../stores/layout.js';
import { useAuthStore } from '../../stores/auth.js';
import { useChannelsStore } from '../../stores/channels.js';
import { UserSettingsModal } from '../common/UserSettingsModal.js';
import { InviteModal } from '../common/InviteModal.js';
import { SpaceSettingsModal, useCanManageSpace, useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Avatar } from '../common/Avatar.js';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu.js';
import { CreatePortalModal } from '../portals/CreatePortalModal.js';
import { CreateChannelModal } from '../channels/CreateChannelModal.js';
import { CreateCategoryModal } from '../channels/CreateCategoryModal.js';
import { MySpacePreferences } from '../settings/MySpacePreferences.js';
import type { Space, Channel, ChannelCategory } from '@gud/shared';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  space: Space | null;
  channels: Channel[];
  categories: ChannelCategory[];
  activeChannelId: string | null;
  fullWidth?: boolean;
}

// ─── Sortable Channel Wrapper ───

function SortableChannel({
  ch,
  renderChannel,
  canDrag,
}: {
  ch: Channel;
  renderChannel: (ch: Channel, dragHandleProps?: any) => React.ReactNode;
  canDrag: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ch.id, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {renderChannel(ch, canDrag ? listeners : undefined)}
    </div>
  );
}

// ─── Sortable Category Wrapper ───

function SortableCategory({
  category,
  children,
  canDrag,
  collapsed,
  onToggle,
  onAddClick,
  canCreateChannels,
}: {
  category: ChannelCategory;
  children: React.ReactNode;
  canDrag: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onAddClick: (e: React.MouseEvent) => void;
  canCreateChannels: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `cat-${category.id}`, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={sidebarStyles.categoryRow}>
        {canDrag && (
          <span {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0 2px' }}>
            <GripVertical size={12} />
          </span>
        )}
        <button
          onClick={onToggle}
          style={sidebarStyles.categoryHeader}
        >
          <span style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex', transition: 'transform 0.15s' }}>
            <ChevronDown size={12} />
          </span>
          {category.name}
        </button>
        {canCreateChannels && (
          <button
            onClick={onAddClick}
            onContextMenu={onAddClick}
            style={sidebarStyles.addChannelBtn}
            title="Create Channel or Category"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}

export function ChannelSidebar({ space, channels, categories, activeChannelId, fullWidth }: Props) {
  const navigate = useNavigate();
  const toggleChannelSidebar = useLayoutStore((s) => s.toggleChannelSidebar);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unreads = useChannelsStore((s) => s.unreads);
  const mutedChannels = useChannelsStore((s) => s.mutedChannels);
  const toggleMute = useChannelsStore((s) => s.toggleMute);
  const markRead = useChannelsStore((s) => s.markRead);
  const reorderChannels = useChannelsStore((s) => s.reorderChannels);
  const reorderCategories = useChannelsStore((s) => s.reorderCategories);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSpaceSettings, setShowSpaceSettings] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channelId: string } | null>(null);
  const [portalChannelId, setPortalChannelId] = useState<string | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const canManage = useCanManageSpace(space?.id || '');
  const canCreateChannels = useHasSpacePermission(space?.id || '', Permissions.MANAGE_CHANNELS);

  // DnD state
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  if (!space) {
    return <div style={{ ...sidebarStyles.sidebar, width: fullWidth ? '100%' : 240 }} />;
  }

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, channelId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, channelId });
  };

  // Context menu for + buttons
  const handleAddMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAddMenu({ x: e.clientX, y: e.clientY });
  };

  const addMenuItems: ContextMenuItem[] = [
    {
      label: 'Add Channel',
      icon: <Hash size={16} />,
      onClick: () => setShowCreateChannel(true),
    },
    {
      label: 'Add Category',
      icon: <FolderPlus size={16} />,
      onClick: () => setShowCreateCategory(true),
    },
  ];

  // Group channels by category
  const uncategorized = channels.filter((ch) => !ch.categoryId);
  const byCategory = new Map<string, Channel[]>();
  for (const ch of channels) {
    if (ch.categoryId) {
      const list = byCategory.get(ch.categoryId) || [];
      list.push(ch);
      byCategory.set(ch.categoryId, list);
    }
  }

  // Move a channel to a different category (or remove from category)
  const moveChannelToCategory = (channelId: string, targetCategoryId: string | null) => {
    const ch = channels.find((c) => c.id === channelId);
    if (!ch || ch.categoryId === targetCategoryId) return;

    // Get target group and assign position at end
    const targetGroup = targetCategoryId
      ? channels.filter((c) => c.categoryId === targetCategoryId)
      : channels.filter((c) => !c.categoryId);

    const items = [
      { channelId, position: targetGroup.length, categoryId: targetCategoryId },
    ];

    // Optimistic update
    const newChannels = channels.map((c) =>
      c.id === channelId ? { ...c, categoryId: targetCategoryId, position: targetGroup.length } : c,
    );
    useChannelsStore.setState({ channels: newChannels });
    reorderChannels(space.id, items);
  };

  const getContextMenuItems = (ch: Channel): ContextMenuItem[] => {
    const isMuted = mutedChannels.has(ch.id);

    const items: ContextMenuItem[] = [
      {
        label: 'Mark as Read',
        icon: <CheckCheck size={16} />,
        onClick: () => {
          markRead(space.id, ch.id, '99999999999999999999');
        },
      },
      {
        label: isMuted ? 'Unmute Channel' : 'Mute Channel',
        icon: isMuted ? <Bell size={16} /> : <BellOff size={16} />,
        onClick: () => toggleMute(space.id, ch.id),
      },
      {
        label: 'Copy Link',
        icon: <Link size={16} />,
        onClick: () => navigator.clipboard.writeText(`${window.location.origin}/space/${space.id}/channel/${ch.id}`),
      },
    ];

    if (!ch.isAdmin && !ch.isPortal) {
      items.push({
        label: 'Create Portal',
        icon: <Zap size={16} />,
        onClick: () => setPortalChannelId(ch.id),
      });
    }

    // "Move to..." options (only for users with MANAGE_CHANNELS, and not for portals/admin)
    if (canCreateChannels && !ch.isAdmin && !ch.isPortal && categories.length > 0) {
      items.push({ label: '', separator: true, icon: undefined, onClick: () => {} });

      // Move to each category the channel isn't already in
      for (const cat of categories) {
        if (cat.id !== ch.categoryId) {
          items.push({
            label: `Move to ${cat.name}`,
            icon: <ArrowRightLeft size={16} />,
            onClick: () => moveChannelToCategory(ch.id, cat.id),
          });
        }
      }

      // Remove from category (move to uncategorized)
      if (ch.categoryId) {
        items.push({
          label: 'Remove from Category',
          icon: <ArrowRightLeft size={16} />,
          onClick: () => moveChannelToCategory(ch.id, null),
        });
      }
    }

    return items;
  };

  // ─── DnD Handlers ───

  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Category reorder (cat on cat)
    if (activeId.startsWith('cat-') && overId.startsWith('cat-')) {
      const activeCatId = activeId.replace('cat-', '');
      const overCatId = overId.replace('cat-', '');
      const oldIndex = categories.findIndex((c) => c.id === activeCatId);
      const newIndex = categories.findIndex((c) => c.id === overCatId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(categories, oldIndex, newIndex);
      useChannelsStore.setState({ categories: reordered });
      reorderCategories(space.id, reordered.map((c, i) => ({ categoryId: c.id, position: i })));
      return;
    }

    // Channel dropped on a category header → move into that category
    if (!activeId.startsWith('cat-') && overId.startsWith('cat-')) {
      const activeChannel = channels.find((c) => c.id === activeId);
      if (!activeChannel) return;
      const targetCatId = overId.replace('cat-', '');
      if (activeChannel.categoryId === targetCatId) return;
      moveChannelToCategory(activeId, targetCatId);
      return;
    }

    // Channel reorder (channel on channel — same or cross category)
    if (!activeId.startsWith('cat-') && !overId.startsWith('cat-')) {
      const activeChannel = channels.find((c) => c.id === activeId);
      const overChannel = channels.find((c) => c.id === overId);
      if (!activeChannel || !overChannel) return;

      const targetCategoryId = overChannel.categoryId || null;

      // Get channels in the target group (excluding the active channel if it's already there)
      const targetGroup = (targetCategoryId
        ? channels.filter((c) => c.categoryId === targetCategoryId)
        : channels.filter((c) => !c.categoryId)
      ).filter((c) => c.id !== activeId);

      // Insert at the over channel's position
      const overIndex = targetGroup.findIndex((c) => c.id === overId);
      const insertIndex = overIndex === -1 ? targetGroup.length : overIndex;
      targetGroup.splice(insertIndex, 0, { ...activeChannel, categoryId: targetCategoryId } as Channel);

      // Build update for target group
      const items: { channelId: string; position: number; categoryId: string | null }[] =
        targetGroup.map((c, i) => ({
          channelId: c.id,
          position: i,
          categoryId: targetCategoryId,
        }));

      // If cross-category, also re-number the source group
      if (activeChannel.categoryId !== targetCategoryId) {
        const sourceGroup = activeChannel.categoryId
          ? channels.filter((c) => c.categoryId === activeChannel.categoryId && c.id !== activeId)
          : channels.filter((c) => !c.categoryId && c.id !== activeId);
        for (let i = 0; i < sourceGroup.length; i++) {
          items.push({
            channelId: sourceGroup[i].id,
            position: i,
            categoryId: activeChannel.categoryId || null,
          });
        }
      }

      // Optimistic update
      const newChannels = channels.map((c) => {
        const update = items.find((u) => u.channelId === c.id);
        return update ? { ...c, position: update.position, categoryId: update.categoryId } : c;
      });
      useChannelsStore.setState({ channels: newChannels });
      reorderChannels(space.id, items);
    }
  };

  // All sortable IDs — one flat list so cross-category channel drag works
  const categoryIds = categories.map((c) => `cat-${c.id}`);
  const allChannelIds = channels.filter((c) => !c.isPortal).map((c) => c.id);
  const allSortableIds = [...categoryIds, ...allChannelIds];

  const renderChannel = (ch: Channel, dragHandleListeners?: any) => {
    const unread = unreads[ch.id];
    const isMuted = mutedChannels.has(ch.id);
    const hasUnread = unread && unread.unreadCount > 0 && !isMuted;
    const isActive = ch.id === activeChannelId;

    const ChannelIcon = ch.isAdmin ? Shield : ch.isPortal ? Zap : Hash;
    const iconColor = ch.isAdmin ? 'var(--warning, #f0b232)' : ch.isPortal ? 'var(--accent)' : 'var(--text-muted)';

    return (
      <button
        key={ch.id}
        onClick={() => navigate(`/space/${space.id}/channel/${ch.id}`)}
        onContextMenu={(e) => handleContextMenu(e, ch.id)}
        style={{
          ...sidebarStyles.channelItem,
          background: isActive ? 'var(--hover)' : 'transparent',
          color: isActive || hasUnread ? 'var(--text-primary)' : isMuted ? 'var(--text-muted)' : 'var(--text-secondary)',
          fontWeight: hasUnread ? 700 : 400,
          opacity: isMuted ? 0.5 : 1,
        }}
        title={ch.isPortal ? `Portal from another space` : ch.isAdmin ? 'Admin channel' : undefined}
      >
        {dragHandleListeners && (
          <span
            {...dragHandleListeners}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', marginRight: -2 }}
          >
            <GripVertical size={14} />
          </span>
        )}
        <ChannelIcon size={18} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
        {hasUnread && (
          <span style={sidebarStyles.badge}>
            {unread.unreadCount > 99 ? '99+' : unread.unreadCount}
          </span>
        )}
      </button>
    );
  };

  // Drag overlay preview
  const draggedChannel = dragActiveId && !dragActiveId.startsWith('cat-')
    ? channels.find((c) => c.id === dragActiveId)
    : null;
  const draggedCategory = dragActiveId?.startsWith('cat-')
    ? categories.find((c) => `cat-${c.id}` === dragActiveId)
    : null;

  return (
    <div style={{ ...sidebarStyles.sidebar, ...(fullWidth ? { width: undefined, flex: 1, flexShrink: 1, minWidth: 0 } : { width: 240 }) }}>
      <div style={sidebarStyles.header}>
        <h2 style={sidebarStyles.spaceName}>{space.name}</h2>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={() => setShowPreferences(true)} style={sidebarStyles.inviteBtn} title="Notification Preferences">
            <SlidersHorizontal size={18} />
          </button>
          <button onClick={() => setShowInvite(true)} style={sidebarStyles.inviteBtn} title="Invite People">
            <UserPlus size={18} />
          </button>
          {canManage && (
            <button onClick={() => setShowSpaceSettings(true)} style={sidebarStyles.inviteBtn} title="Space Settings">
              <Settings size={18} />
            </button>
          )}
          {!fullWidth && (
            <button onClick={toggleChannelSidebar} style={sidebarStyles.inviteBtn} title="Collapse sidebar">
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>
      </div>

      <div style={sidebarStyles.channelList}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Single flat SortableContext for all draggable items */}
          <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
            {/* Categorized channels */}
            {categories.map((cat) => {
              const catChannels = byCategory.get(cat.id) || [];
              const collapsed = collapsedCategories.has(cat.id);
              return (
                <SortableCategory
                  key={cat.id}
                  category={cat}
                  canDrag={canCreateChannels}
                  collapsed={collapsed}
                  onToggle={() => toggleCategory(cat.id)}
                  onAddClick={handleAddMenu}
                  canCreateChannels={canCreateChannels}
                >
                  {catChannels.map((ch) => (
                    <SortableChannel
                      key={ch.id}
                      ch={ch}
                      renderChannel={renderChannel}
                      canDrag={canCreateChannels}
                    />
                  ))}
                </SortableCategory>
              );
            })}

            {/* Uncategorized channels */}
            {uncategorized.length > 0 && (
              <>
                <div style={sidebarStyles.sectionRow}>
                  {categories.length > 0 && <div style={sidebarStyles.sectionLabel}>Channels</div>}
                  {categories.length === 0 && <div style={sidebarStyles.sectionLabel}>Text Channels</div>}
                  {canCreateChannels && (
                    <button
                      onClick={() => setShowCreateChannel(true)}
                      onContextMenu={handleAddMenu}
                      style={sidebarStyles.addChannelBtn}
                      title="Create Channel or Category"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                {uncategorized.map((ch) => (
                  <SortableChannel
                    key={ch.id}
                    ch={ch}
                    renderChannel={renderChannel}
                    canDrag={canCreateChannels}
                  />
                ))}
              </>
            )}
            {/* Show + button even when no channels exist yet */}
            {uncategorized.length === 0 && categories.length === 0 && canCreateChannels && (
              <div style={sidebarStyles.sectionRow}>
                <div style={sidebarStyles.sectionLabel}>Text Channels</div>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  onContextMenu={handleAddMenu}
                  style={sidebarStyles.addChannelBtn}
                  title="Create Channel or Category"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </SortableContext>

          <DragOverlay>
            {draggedChannel && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                <Hash size={18} style={{ color: 'var(--text-muted)' }} />
                {draggedChannel.name}
              </div>
            )}
            {draggedCategory && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', padding: '6px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {draggedCategory.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Context menu for channels */}
      {contextMenu && (() => {
        const ch = channels.find((c) => c.id === contextMenu.channelId);
        if (!ch) return null;
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={getContextMenuItems(ch)}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}

      {/* Context menu for + buttons */}
      {addMenu && (
        <ContextMenu
          x={addMenu.x}
          y={addMenu.y}
          items={addMenuItems}
          onClose={() => setAddMenu(null)}
        />
      )}

      {/* User bar */}
      <div style={sidebarStyles.userBar}>
        <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Avatar src={user?.avatarUrl || null} name={user?.displayName || '?'} size={28} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
            {user?.displayName}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {user?.username}
          </div>
        </div>
        <button onClick={logout} style={sidebarStyles.logoutBtn} title="Sign out">
          <LogOut size={16} />
        </button>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
      {showInvite && space && <InviteModal spaceId={space.id} onClose={() => setShowInvite(false)} />}
      {showSpaceSettings && space && <SpaceSettingsModal spaceId={space.id} onClose={() => setShowSpaceSettings(false)} />}
      {portalChannelId && space && (
        <CreatePortalModal
          channelId={portalChannelId}
          sourceSpaceId={space.id}
          onClose={() => setPortalChannelId(null)}
        />
      )}
      {showCreateChannel && space && (
        <CreateChannelModal
          spaceId={space.id}
          categories={categories}
          onClose={() => setShowCreateChannel(false)}
        />
      )}
      {showCreateCategory && space && (
        <CreateCategoryModal
          spaceId={space.id}
          onClose={() => setShowCreateCategory(false)}
        />
      )}
      {showPreferences && space && (
        <MySpacePreferences
          spaceId={space.id}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </div>
  );
}

const sidebarStyles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    height: '100%',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  header: {
    padding: '0 16px',
    height: 48,
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.3rem',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    borderRadius: 'var(--radius)',
  },
  spaceName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  channelList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 8px',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '8px 8px 4px',
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
  },
  addChannelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '8px 8px 4px',
    cursor: 'pointer',
  },
  channelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '6px 8px',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  hash: {
    color: 'var(--text-muted)',
    fontSize: '1.1rem',
    fontWeight: 500,
  },
  badge: {
    background: 'var(--danger)',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 10,
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
};
