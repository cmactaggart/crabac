import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, X, Star, Download, MapPin, Mountain, TrendingUp, Link as LinkIcon, Copy } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';

interface RouteItem {
  id: string;
  name: string;
  description: string | null;
  channelId: string;
  channelName?: string;
  categoryId: string | null;
  url: string;
  originalName: string;
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  flatness: number | null;
  activityType: string | null;
  geojson: any;
  category: { id: string; name: string } | null;
  author?: { id: string; username: string; displayName: string; avatarUrl: string | null };
  starred?: boolean;
}

interface ChannelOption {
  id: string;
  name: string;
}

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
}

function formatDistance(km: number): string {
  return `${(km * 0.621371).toFixed(1)} mi`;
}

function formatElevation(m: number): string {
  return `${Math.round(m * 3.28084)} ft`;
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

function generateMiniMapPoints(geojson: any, width: number, height: number): string {
  const coords: [number, number][] = [];
  if (!geojson?.features) return '';
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (geom.type === 'LineString') {
      for (const c of geom.coordinates) coords.push([c[0], c[1]]);
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        for (const c of line) coords.push([c[0], c[1]]);
      }
    }
  }
  if (coords.length < 2) return '';
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
  const pad = 0.08, lngRange = (maxLng - minLng) || 0.001, latRange = (maxLat - minLat) || 0.001;
  return sampled
    .map(([lng, lat]) => {
      const x = ((lng - minLng) / lngRange) * (1 - 2 * pad) + pad;
      const y = (1 - (lat - minLat) / latRange) * (1 - 2 * pad) + pad;
      return `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`;
    })
    .join(' ');
}

export function PublicRoutesHome() {
  const { spaceSlug } = useParams();
  const theme = usePublicTheme();
  const c = theme.colors;
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [items, setItems] = useState<RouteItem[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch space info
  useEffect(() => {
    if (!spaceSlug) return;
    boardApi<{ space: SpaceInfo }>(`/${spaceSlug}`)
      .then((data) => setSpace(data.space))
      .catch(() => {});
  }, [spaceSlug]);

  const fetchItems = useCallback(async (before?: string) => {
    if (!spaceSlug) return;
    try {
      const params = new URLSearchParams({ limit: '30', sort: 'newest', order: 'desc' });
      if (before) params.set('before', before);
      if (searchQuery) params.set('search', searchQuery);
      if (filterType) params.set('type', filterType);
      if (filterChannel) params.set('channelId', filterChannel);
      const data = await boardApi<{ items: RouteItem[]; channels: ChannelOption[] }>(
        `/${spaceSlug}/all-routes?${params}`,
      );
      if (!before) {
        setItems(data.items);
        setChannels(data.channels);
      } else {
        setItems((prev) => [...prev, ...data.items]);
      }
      setHasMore(data.items.length >= 30);
    } catch (err: any) {
      setError(err.message || 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, [spaceSlug, searchQuery, filterType, filterChannel]);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setHasMore(true);
    fetchItems();
  }, [fetchItems]);

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
    const item = items.find((i) => i.id === routeId);
    if (!item) return;
    try {
      if (starred) {
        await boardApi(`/${spaceSlug}/${item.channelName}/routes/${routeId}/star`, { method: 'DELETE' });
      } else {
        await boardApi(`/${spaceSlug}/${item.channelName}/routes/${routeId}/star`, { method: 'POST' });
      }
      setItems((prev) => prev.map((i) => i.id === routeId ? { ...i, starred: !starred } : i));
      if (selectedRoute?.id === routeId) setSelectedRoute((r) => r ? { ...r, starred: !starred } : r);
    } catch { /* ignore */ }
  };

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: c.headingColor, fontWeight: 700 }}>{space?.name}</h1>
        {space?.description && <p style={{ margin: '6px 0 0', color: c.secondaryText, fontSize: '0.9rem' }}>{space.description}</p>}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: 6, flex: '1 1 150px', minWidth: 120 }}>
          <Search size={14} style={{ color: c.mutedText, flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes..."
            style={{ flex: 1, background: 'none', border: 'none', color: c.pageText, fontSize: '0.85rem', outline: 'none' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: c.mutedText, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          )}
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '6px 10px', background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: 6, color: c.pageText, fontSize: '0.85rem', outline: 'none' }}
        >
          <option value="">All types</option>
          <option value="ride">Ride</option>
          <option value="run">Run</option>
          <option value="walk">Walk</option>
        </select>
        {channels.length > 1 && (
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            style={{ padding: '6px 10px', background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: 6, color: c.pageText, fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="">All libraries</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ marginTop: 16 }}>
        {loading && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>No public routes available</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {items.map((item) => (
              <RouteCard
                key={item.id}
                item={item}
                spaceSlug={spaceSlug!}
                onStar={() => handleStar(item.id, !!item.starred)}
                onClick={() => setSelectedRoute(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail overlay */}
      {selectedRoute && (
        <RouteDetailOverlay
          item={selectedRoute}
          spaceSlug={spaceSlug!}
          onClose={() => setSelectedRoute(null)}
          onStar={() => handleStar(selectedRoute.id, !!selectedRoute.starred)}
        />
      )}
    </div>
  );
}

function RouteCard({ item, spaceSlug, onStar, onClick }: { item: RouteItem; spaceSlug: string; onStar: () => void; onClick: () => void }) {
  const theme = usePublicTheme();
  const c = theme.colors;
  const polyline = useMemo(() => generateMiniMapPoints(item.geojson, 200, 120), [item.geojson]);

  return (
    <div style={{ background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, cursor: 'pointer', transition: 'box-shadow 0.15s' }} onClick={onClick} role="button" tabIndex={0}>
      <div style={{ height: 120, background: '#f3f4f6', overflow: 'hidden' }}>
        <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
          <polyline points={polyline} fill="none" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: c.headingColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          <button onClick={(e) => { e.stopPropagation(); onStar(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <Star size={16} fill={item.starred ? '#f0b232' : 'none'} color={item.starred ? '#f0b232' : '#ccc'} />
          </button>
        </div>
        {item.author?.displayName && (
          <span style={{ fontSize: '0.75rem', color: c.mutedText }}>by {item.author.displayName}</span>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {item.channelName && (
            <Link
              to={`/routes/${spaceSlug}/${item.channelName}`}
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', background: '#f3f4f6', borderRadius: 10, color: c.secondaryText, width: 'fit-content', textDecoration: 'none' }}
            >
              {item.channelName}
            </Link>
          )}
          {item.category && <span style={{ display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', background: '#f3f4f6', borderRadius: 10, color: c.secondaryText, width: 'fit-content' }}>{item.category.name}</span>}
          {activityLabel(item.activityType) && (
            <span style={{ display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', background: c.accent, borderRadius: 10, color: c.contentBg, width: 'fit-content' }}>
              {activityLabel(item.activityType)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: '0.78rem', color: c.secondaryText }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={13} /> {formatDistance(item.distanceKm)}</span>
          {item.elevationGainM != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Mountain size={13} /> +{formatElevation(item.elevationGainM)}</span>
          )}
          {item.flatness != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TrendingUp size={13} /> {formatFlatness(item.flatness)}</span>
          )}
        </div>
        {item.description && (
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#888', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function RouteDetailOverlay({ item, spaceSlug, onClose, onStar }: {
  item: RouteItem;
  spaceSlug: string;
  onClose: () => void;
  onStar: () => void;
}) {
  const theme = usePublicTheme();
  const c = theme.colors;
  const polyline = useMemo(() => generateMiniMapPoints(item.geojson, 500, 250), [item.geojson]);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/routes/${spaceSlug}/${item.channelName}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: c.contentBg, borderRadius: 10, width: 600, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        {item.geojson && (
          <div style={{ height: 250, background: '#f3f4f6', overflow: 'hidden' }}>
            <svg viewBox="0 0 500 250" style={{ width: '100%', height: '100%' }}>
              <polyline points={polyline} fill="none" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: c.headingColor }}>{item.name}</h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={onStar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <Star size={18} fill={item.starred ? '#f0b232' : 'none'} color={item.starred ? '#f0b232' : '#ccc'} />
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.mutedText, cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
          </div>
          {item.author && <span style={{ fontSize: '0.8rem', color: c.mutedText }}>by {item.author.displayName}</span>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {item.activityType && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: c.accent, color: c.contentBg, borderRadius: 10, fontWeight: 600 }}>
                {activityLabel(item.activityType)}
              </span>
            )}
            {item.category && <span style={{ display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', background: '#f3f4f6', borderRadius: 10, color: c.secondaryText, width: 'fit-content' }}>{item.category.name}</span>}
            {item.channelName && (
              <Link to={`/routes/${spaceSlug}/${item.channelName}`} style={{ display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', background: '#f3f4f6', borderRadius: 10, color: c.secondaryText, width: 'fit-content', textDecoration: 'none' }}>
                {item.channelName}
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.85rem', color: c.secondaryText }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={14} /> {formatDistance(item.distanceKm)}</span>
            {item.elevationGainM != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Mountain size={14} /> +{formatElevation(item.elevationGainM)}</span>
            )}
            {item.flatness != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TrendingUp size={14} /> {formatFlatness(item.flatness)}</span>
            )}
          </div>
          {item.description && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: c.secondaryText, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.description}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <a href={item.url} download={item.originalName} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', padding: '6px 14px', background: '#f3f4f6', border: `1px solid ${c.contentBorder}`, borderRadius: 6, color: c.pageText, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' }}>
              <Download size={14} /> Download GPX
            </a>
            <button onClick={handleCopyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', padding: '6px 14px', background: '#f3f4f6', border: `1px solid ${c.contentBorder}`, borderRadius: 6, color: c.pageText, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' }}>
              <Copy size={14} /> {copied ? 'Copied!' : 'Get Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
