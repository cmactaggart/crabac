import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { MapPinned, Plus, Star, Download, Search, X, List, LayoutGrid, ChevronDown, Trash2, MapPin, Mountain, TrendingUp, Copy, CalendarPlus, Flag, Settings } from 'lucide-react';
import { getSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
import { Permissions, hasPermission, combinePermissions } from '@crabac/shared';
import type { Channel, RouteItem, RouteCategory, Role, CalendarEvent } from '@crabac/shared';
import { ChannelSettingsPanel } from '../channels/ChannelSettingsPanel.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { useChannelsStore } from '../../stores/channels.js';
import { RouteUploadModal } from './RouteUploadModal.js';
import { CreateEventModal } from '../calendar/CreateEventModal.js';
import { RouteCategoryManager } from './RouteCategoryManager.js';
import { ReportModal } from '../moderation/ReportModal.js';
import { MiniMap } from '../common/MiniMap.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import type { DistanceUnits } from '@crabac/shared';

const LazyGpxMapModal = React.lazy(() => import('../messages/GpxMapModal.js'));

type ViewMode = 'card' | 'table';
type SortField = 'newest' | 'name' | 'distance' | 'elevation' | 'flatness';

function formatDistance(km: number, units: DistanceUnits): string {
  if (units === 'imperial') {
    const mi = km * 0.621371;
    return `${mi.toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

function formatElevation(m: number, units: DistanceUnits): string {
  if (units === 'imperial') return `${Math.round(m * 3.28084)} ft`;
  return `${m} m`;
}

function formatFlatness(f: number): string {
  return `${f.toFixed(0)} ft/mi`;
}

function activityLabel(type: string | null): string | null {
  if (type === 'ride') return 'Ride';
  if (type === 'run') return 'Run';
  if (type === 'walk') return 'Walk';
  return null;
}

interface Props {
  channelId: string;
  channel: Channel | null;
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function RoutesChannelView({ channelId, channel, spaceId, showBackButton, onBack }: Props) {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<RouteItem[]>([]);
  const [categories, setCategories] = useState<RouteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sortField, setSortField] = useState<SortField>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStarred, setFilterStarred] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [filterType, setFilterType] = useState('');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [prefillRouteId, setPrefillRouteId] = useState('');
  const [reportTarget, setReportTarget] = useState<RouteItem | null>(null);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canManageChannels = useHasSpacePermission(spaceId, Permissions.MANAGE_CHANNELS);

  const user = useAuthStore((s) => s.user);
  const spaces = useSpacesStore((s) => s.spaces);
  const channels = useChannelsStore((s) => s.channels);
  const space = spaces.find((s) => s.id === spaceId);
  const members = useSpacesStore((s) => s.members);
  const [roles, setRoles] = useState<Role[]>([]);
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
  }, [spaceId]);

  const userPerms = useMemo(() => {
    if (!user) return 0n;
    const space = spaces.find((s) => s.id === spaceId);
    if (space?.ownerId === user.id) return combinePermissions(...Object.values(Permissions));
    const member = members.find((m) => m.userId === user.id);
    if (!member?.roles?.length) {
      const defaultRole = roles.find((r: any) => r.isDefault);
      return defaultRole ? BigInt(defaultRole.permissions) : 0n;
    }
    return combinePermissions(
      ...member.roles.map((r) => {
        const full = roles.find((fr: any) => fr.id === r.id);
        return full ? BigInt(full.permissions) : 0n;
      }),
    );
  }, [user, spaces, members, roles, spaceId]);

  const canUpload = hasPermission(userPerms, Permissions.SEND_MESSAGES) && hasPermission(userPerms, Permissions.ATTACH_FILES);
  const canManage = hasPermission(userPerms, Permissions.MANAGE_MESSAGES);
  const canManageCategories = hasPermission(userPerms, Permissions.MANAGE_ROUTE_CATEGORIES);

  // Fetch categories
  useEffect(() => {
    api<RouteCategory[]>(`/spaces/${spaceId}/route-categories`)
      .then(setCategories)
      .catch(() => {});
  }, [spaceId]);

  const fetchItems = useCallback(async (before?: string) => {
    try {
      const params = new URLSearchParams({ limit: '30', sort: sortField, order: sortOrder });
      if (before) params.set('before', before);
      if (searchQuery) params.set('search', searchQuery);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStarred) params.set('starred', 'true');
      if (filterType) params.set('type', filterType);
      const data = await api<RouteItem[]>(`/channels/${channelId}/routes?${params}`);
      if (before) {
        setItems((prev) => [...prev, ...data]);
      } else {
        setItems(data);
      }
      setHasMore(data.length >= 30);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId, sortField, sortOrder, searchQuery, filterCategory, filterStarred, filterType]);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setHasMore(true);
    fetchItems();
  }, [fetchItems]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('channel:join', { channelId });

    const onItemCreated = (item: RouteItem) => {
      setItems((prev) => [item, ...prev]);
    };
    const onItemDeleted = ({ itemId }: { itemId: string }) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSelectedRoute((sel) => sel?.id === itemId ? null : sel);
    };

    socket.on('route:item_created', onItemCreated);
    socket.on('route:item_deleted', onItemDeleted);

    return () => {
      socket.emit('channel:leave', { channelId });
      socket.off('route:item_created', onItemCreated);
      socket.off('route:item_deleted', onItemDeleted);
    };
  }, [channelId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      if (hasMore && !loading && items.length > 0) {
        fetchItems(items[items.length - 1].id);
      }
    }
  };

  const handleStar = async (routeId: string, starred: boolean) => {
    try {
      if (starred) {
        await api(`/channels/${channelId}/routes/${routeId}/star`, { method: 'DELETE' });
      } else {
        await api(`/channels/${channelId}/routes/${routeId}/star`, { method: 'POST' });
      }
      setItems((prev) => prev.map((i) => i.id === routeId ? { ...i, starred: !starred } : i));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (routeId: string) => {
    if (!confirm('Delete this route?')) return;
    try {
      await api(`/channels/${channelId}/routes/${routeId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== routeId));
    } catch {
      // ignore
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    setLoading(true);
    fetchItems();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const handleCopyLink = (item: RouteItem) => {
    const url = `${window.location.origin}/space/${spaceId}/channel/${channelId}#route-${item.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const handleCreateEvent = (item: RouteItem) => {
    setPrefillRouteId(item.id);
    setShowCreateEvent(true);
  };

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {showBackButton && onBack && (
          <button onClick={onBack} style={styles.backBtn}>Back</button>
        )}
        <div style={styles.headerInfo}>
          <MapPinned size={20} style={{ color: 'var(--text-muted)' }} />
          <h3 style={styles.channelName}>{channel?.name || 'Routes'}</h3>
          {channel?.topic && <span style={styles.topic}>{channel.topic}</span>}
        </div>
        {!isMobile && (
          <div style={styles.viewToggle}>
            <button
              onClick={() => setViewMode('card')}
              style={{ ...styles.toggleBtn, background: viewMode === 'card' ? 'var(--hover)' : 'transparent', color: viewMode === 'card' ? 'var(--text-primary)' : 'var(--text-muted)' }}
              title="Card view"
            ><LayoutGrid size={15} /></button>
            <button
              onClick={() => setViewMode('table')}
              style={{ ...styles.toggleBtn, background: viewMode === 'table' ? 'var(--hover)' : 'transparent', color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)' }}
              title="Table view"
            ><List size={15} /></button>
          </div>
        )}
        {canManageChannels && (
          <button
            onClick={() => setShowChannelSettings(!showChannelSettings)}
            style={{ ...styles.backBtn, color: showChannelSettings ? 'var(--accent)' : 'var(--text-secondary)' }}
            title="Channel Settings"
          >
            <Settings size={18} />
          </button>
        )}
        {canUpload && (
          <button onClick={() => setShowUpload(true)} style={styles.uploadBtn}>
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <div style={styles.searchWrap}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes..."
            style={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={styles.clearBtn}><X size={14} /></button>
          )}
        </div>
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setFilterStarred(!filterStarred)}
          style={{ ...styles.starFilterBtn, color: filterStarred ? 'var(--warning, #f0b232)' : 'var(--text-muted)' }}
          title="Show starred only"
        >
          <Star size={15} fill={filterStarred ? 'currentColor' : 'none'} />
        </button>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All types</option>
          <option value="ride">Ride</option>
          <option value="run">Run</option>
          <option value="walk">Walk</option>
        </select>
        {canManageCategories && (
          <button
            onClick={() => setShowCategories(!showCategories)}
            style={styles.categoryMgrBtn}
            title="Manage categories"
          >
            <ChevronDown size={14} /> Categories
          </button>
        )}
      </div>

      {showCategories && canManageCategories && (
        <RouteCategoryManager
          spaceId={spaceId}
          categories={categories}
          onCategoriesChange={setCategories}
        />
      )}

      {/* Content */}
      <div style={styles.content} ref={scrollRef} onScroll={handleScroll}>
        {loading && items.length === 0 ? (
          <div style={styles.placeholder}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={styles.placeholder}>
            <MapPinned size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 0' }}>
              No routes yet. {canUpload ? 'Click "Add" to upload a GPX file or import from your collection.' : ''}
            </p>
          </div>
        ) : viewMode === 'card' || isMobile ? (
          <div style={styles.cardGrid}>
            {items.map((item) => (
              <RouteCard
                key={item.id}
                item={item}
                units={units}
                canDelete={item.authorId === user?.id || canManage}
                isOwn={item.authorId === user?.id}
                onStar={() => handleStar(item.id, !!item.starred)}
                onDelete={() => handleDelete(item.id)}
                onClick={() => setSelectedRoute(item)}
                onDownload={() => {}}
                onCopyLink={() => handleCopyLink(item)}
                onCreateEvent={() => handleCreateEvent(item)}
                onReport={() => setReportTarget(item)}
              />
            ))}
          </div>
        ) : (
          <RouteTable
            items={items}
            units={units}
            sortField={sortField}
            sortOrder={sortOrder}
            userId={user?.id}
            canManage={canManage}
            onSort={handleSort}
            onStar={(id, starred) => handleStar(id, starred)}
            onDelete={handleDelete}
            onClick={setSelectedRoute}
          />
        )}
      </div>

      {/* Detail overlay */}
      {selectedRoute && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedRoute(null)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', width: 600, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
            {/* Map preview */}
            {selectedRoute.geojson && (
              <div style={{ height: 250, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                <Suspense fallback={null}>
                  <LazyGpxMapModal
                    attachment={{
                      id: selectedRoute.id,
                      url: selectedRoute.url,
                      filename: selectedRoute.filename,
                      originalName: selectedRoute.originalName,
                      mimeType: 'application/gpx+xml',
                      size: selectedRoute.fileSize,
                    }}
                    gpx={{
                      trackName: selectedRoute.name,
                      distanceKm: selectedRoute.distanceKm,
                      elevationGainM: selectedRoute.elevationGainM,
                      elevationLossM: selectedRoute.elevationLossM,
                      durationSec: selectedRoute.durationSec || 0,
                      bounds: selectedRoute.bounds,
                      geojson: selectedRoute.geojson,
                    }}
                    onClose={() => setSelectedRoute(null)}
                  />
                </Suspense>
              </div>
            )}
            {/* Info section */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedRoute.name}</h3>
                <button onClick={() => setSelectedRoute(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              {selectedRoute.author && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>by {selectedRoute.author.displayName}</span>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedRoute.activityType && <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 10, fontWeight: 600 }}>{activityLabel(selectedRoute.activityType)}</span>}
                {selectedRoute.category && <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 10, color: 'var(--text-secondary)' }}>{selectedRoute.category.name}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {formatDistance(selectedRoute.distanceKm, units)}</span>
                {selectedRoute.elevationGainM != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mountain size={14} /> +{formatElevation(selectedRoute.elevationGainM, units)}</span>}
                {selectedRoute.flatness != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrendingUp size={14} /> {formatFlatness(selectedRoute.flatness)}</span>}
              </div>
              {selectedRoute.description && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{selectedRoute.description}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <a href={selectedRoute.url} download={selectedRoute.originalName} style={{ ...styles.uploadBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'inline-flex', textDecoration: 'none' }}>
                  <Download size={14} /> Download GPX
                </a>
                <button onClick={() => handleCopyLink(selectedRoute)} style={{ ...styles.uploadBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <Copy size={14} /> Copy Link
                </button>
                <button onClick={() => handleCreateEvent(selectedRoute)} style={{ ...styles.uploadBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  <CalendarPlus size={14} /> Create Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <RouteUploadModal
          channelId={channelId}
          spaceId={spaceId}
          categories={categories}
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {showCreateEvent && (
        <CreateEventModal
          spaceId={spaceId}
          prefillRouteId={prefillRouteId}
          onClose={() => { setShowCreateEvent(false); setPrefillRouteId(''); }}
        />
      )}

      {reportTarget && reportTarget.author && (
        <ReportModal
          reportedUserId={reportTarget.authorId}
          reportedUsername={reportTarget.author.displayName || 'Unknown'}
          spaceId={spaceId}
          channelId={channelId}
          routeId={reportTarget.id}
          messagePreview={reportTarget.name}
          contentLabel="Route"
          onClose={() => setReportTarget(null)}
        />
      )}

    </div>
    {showChannelSettings && channel && (
      <ChannelSettingsPanel
        spaceId={spaceId}
        channel={channel}
        onClose={() => setShowChannelSettings(false)}
      />
    )}
    </div>
  );
}

// ─── Route Card ───

function RouteCard({ item, units, canDelete, isOwn, onStar, onDelete, onClick, onDownload, onCopyLink, onCreateEvent, onReport }: {
  item: RouteItem;
  units: DistanceUnits;
  canDelete: boolean;
  isOwn?: boolean;
  onStar: () => void;
  onDelete: () => void;
  onClick: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  onCreateEvent: () => void;
  onReport?: () => void;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardMap} onClick={onClick}>
        <MiniMap
          geojson={item.geojson}
          bounds={item.bounds}
          width="100%"
          height="100%"
        />
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitleRow}>
          <span style={styles.cardTitle} onClick={onClick}>{item.name}</span>
          <button onClick={(e) => { e.stopPropagation(); onStar(); }} style={styles.starBtn}>
            <Star size={16} fill={item.starred ? 'var(--warning, #f0b232)' : 'none'} color={item.starred ? 'var(--warning, #f0b232)' : 'var(--text-muted)'} />
          </button>
        </div>
        {item.author?.displayName && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>by {item.author.displayName}</span>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {item.category && <span style={styles.categoryBadge}>{item.category.name}</span>}
          {item.activityType && <span style={{ ...styles.categoryBadge, background: 'var(--accent)', color: '#fff' }}>{activityLabel(item.activityType)}</span>}
        </div>
        {item.description && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{item.description}</p>}
        <div style={styles.cardStats}>
          <span style={styles.statItem}><MapPin size={13} /> {formatDistance(item.distanceKm, units)}</span>
          {item.elevationGainM != null && (
            <span style={styles.statItem}><Mountain size={13} /> +{formatElevation(item.elevationGainM, units)}</span>
          )}
          {item.flatness != null && (
            <span style={styles.statItem}><TrendingUp size={13} /> {formatFlatness(item.flatness)}</span>
          )}
        </div>
        <div style={styles.cardActions}>
          <a
            href={item.url}
            download={item.originalName}
            onClick={(e) => e.stopPropagation()}
            style={styles.downloadLink}
          >
            <Download size={13} /> GPX
          </a>
          <button onClick={(e) => { e.stopPropagation(); onCopyLink(); }} style={styles.downloadLink} title="Copy link">
            <Copy size={13} /> Link
          </button>
          <button onClick={(e) => { e.stopPropagation(); onCreateEvent(); }} style={styles.downloadLink} title="Create event">
            <CalendarPlus size={13} /> Event
          </button>
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={styles.deleteBtn}>
              <Trash2 size={13} />
            </button>
          )}
          {!isOwn && onReport && (
            <button onClick={(e) => { e.stopPropagation(); onReport(); }} style={styles.reportBtn} title="Report">
              <Flag size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Route Table ───

function RouteTable({ items, units, sortField, sortOrder, userId, canManage, onSort, onStar, onDelete, onClick }: {
  items: RouteItem[];
  units: DistanceUnits;
  sortField: SortField;
  sortOrder: string;
  userId?: string;
  canManage: boolean;
  onSort: (field: SortField) => void;
  onStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (item: RouteItem) => void;
}) {
  const sortArrow = (field: SortField) => sortField === field ? (sortOrder === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}></th>
            <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => onSort('name')}>Name{sortArrow('name')}</th>
            <th style={styles.th}>Author</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Type</th>
            <th style={{ ...styles.th, cursor: 'pointer', textAlign: 'right' }} onClick={() => onSort('distance')}>Distance{sortArrow('distance')}</th>
            <th style={{ ...styles.th, cursor: 'pointer', textAlign: 'right' }} onClick={() => onSort('elevation')}>Elevation{sortArrow('elevation')}</th>
            <th style={{ ...styles.th, cursor: 'pointer', textAlign: 'right' }} onClick={() => onSort('flatness')}>Flatness{sortArrow('flatness')}</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={styles.tableRow} onClick={() => onClick(item)}>
              <td style={styles.td}>
                <button onClick={(e) => { e.stopPropagation(); onStar(item.id, !!item.starred); }} style={styles.starBtn}>
                  <Star size={14} fill={item.starred ? 'var(--warning, #f0b232)' : 'none'} color={item.starred ? 'var(--warning, #f0b232)' : 'var(--text-muted)'} />
                </button>
              </td>
              <td style={{ ...styles.td, fontWeight: 500 }}>{item.name}</td>
              <td style={styles.td}>{item.author?.displayName || ''}</td>
              <td style={styles.td}>{item.category?.name || ''}</td>
              <td style={styles.td}>{activityLabel(item.activityType) || ''}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{formatDistance(item.distanceKm, units)}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{item.elevationGainM != null ? `+${formatElevation(item.elevationGainM, units)}` : '--'}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{item.flatness != null ? formatFlatness(item.flatness) : '--'}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <a href={item.url} download={item.originalName} onClick={(e) => e.stopPropagation()} style={styles.downloadLink}>
                    <Download size={13} />
                  </a>
                  {(item.authorId === userId || canManage) && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} style={styles.deleteBtn}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius)', fontSize: '0.85rem' },
  headerInfo: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  channelName: { margin: 0, fontSize: '1rem', fontWeight: 600 },
  topic: { fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  viewToggle: { display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', padding: 2, gap: 1, flexShrink: 0 },
  toggleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', padding: '4px 8px', transition: 'background 0.15s, color 0.15s' },
  uploadBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 },
  filterBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', flex: '1 1 150px', minWidth: 120 },
  searchInput: { flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' },
  clearBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' },
  filterSelect: { padding: '5px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' },
  starFilterBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center' },
  categoryMgrBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.8rem' },
  content: { flex: 1, overflow: 'auto', padding: 12 },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' },

  // Card view
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
  card: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardMap: { aspectRatio: '1', background: 'var(--bg-tertiary)', cursor: 'pointer', overflow: 'hidden' },
  cardBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 6 },
  cardTitle: { fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  categoryBadge: { display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', background: 'var(--bg-tertiary)', borderRadius: 10, color: 'var(--text-secondary)', width: 'fit-content' },
  cardStats: { display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: '0.78rem', color: 'var(--text-secondary)' },
  statItem: { display: 'inline-flex', alignItems: 'center', gap: 3 },
  cardActions: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 },
  downloadLink: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' },
  reportBtn: { background: 'none', border: 'none', color: 'var(--warning, #faa61a)', cursor: 'pointer', padding: 2, display: 'flex', opacity: 0.7 },
  starBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' },

  // Table view
  table: { width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  tableRow: { cursor: 'pointer', borderBottom: '1px solid var(--border)' },
  td: { padding: '8px 10px', color: 'var(--text-primary)', whiteSpace: 'nowrap' },
};
