import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Star, Download, Search, X, List, LayoutGrid, MapPin, Mountain, TrendingUp, Copy } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { RouteDetailOverlay } from './PublicRoutesHome.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';

type ViewMode = 'card' | 'table';
type SortField = 'newest' | 'name' | 'distance' | 'elevation' | 'flatness';

interface RouteItem {
  id: string;
  name: string;
  description: string | null;
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

function activityLabel(type: string | null): string | null {
  if (type === 'ride') return 'Ride';
  if (type === 'run') return 'Run';
  if (type === 'walk') return 'Walk';
  return null;
}

interface RouteCategory {
  id: string;
  name: string;
}

function formatDistance(km: number): string {
  const mi = km * 0.621371;
  return `${mi.toFixed(1)} mi`;
}

function formatElevation(m: number): string {
  return `${Math.round(m * 3.28084)} ft`;
}

function formatFlatness(f: number): string {
  return `${f.toFixed(0)} ft/mi`;
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

export function PublicRoutesView() {
  const { spaceSlug, channelName } = useParams();
  const theme = usePublicTheme();
  const c = theme.colors;
  const [items, setItems] = useState<RouteItem[]>([]);
  const [categories, setCategories] = useState<RouteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sortField, setSortField] = useState<SortField>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch categories
  useEffect(() => {
    if (!spaceSlug || !channelName) return;
    boardApi<RouteCategory[]>(`/${spaceSlug}/${channelName}/route-categories`)
      .then(setCategories)
      .catch(() => {});
  }, [spaceSlug, channelName]);

  const fetchItems = useCallback(async (before?: string) => {
    if (!spaceSlug || !channelName) return;
    try {
      const params = new URLSearchParams({ limit: '30', sort: sortField, order: sortOrder });
      if (before) params.set('before', before);
      if (searchQuery) params.set('search', searchQuery);
      if (filterCategory) params.set('category', filterCategory);
      if (filterType) params.set('type', filterType);
      const data = await boardApi<RouteItem[]>(
        `/${spaceSlug}/${channelName}/routes?${params}`,
      );
      if (before) {
        setItems((prev) => [...prev, ...data]);
      } else {
        setItems(data);
      }
      setHasMore(data.length >= 30);
    } catch (err: any) {
      setError(err.message || 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, [spaceSlug, channelName, sortField, sortOrder, searchQuery, filterCategory, filterType]);

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
    try {
      if (starred) {
        await boardApi(`/${spaceSlug}/${channelName}/routes/${routeId}/star`, { method: 'DELETE' });
      } else {
        await boardApi(`/${spaceSlug}/${channelName}/routes/${routeId}/star`, { method: 'POST' });
      }
      setItems((prev) => prev.map((i) => i.id === routeId ? { ...i, starred: !starred } : i));
      if (selectedRoute?.id === routeId) setSelectedRoute((r) => r ? { ...r, starred: !starred } : r);
    } catch {
      // ignore (might not be authenticated)
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c53030' }}>{error}</div>;

  const sortArrow = (field: SortField) => sortField === field ? (sortOrder === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Link to={`/routes/${spaceSlug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: c.accent, textDecoration: 'none', fontSize: '0.85rem' }}>
          <ChevronLeft size={16} /> All Routes
        </Link>
        <span style={{ fontSize: '0.85rem', color: c.secondaryText }}>{channelName}</span>
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
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '6px 10px', background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: 6, color: c.pageText, fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        )}
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
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 6, padding: 2, gap: 1 }}>
          <button
            onClick={() => setViewMode('card')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 8px', background: viewMode === 'card' ? c.contentBorder : 'transparent', color: viewMode === 'card' ? c.headingColor : c.mutedText }}
          ><LayoutGrid size={15} /></button>
          <button
            onClick={() => setViewMode('table')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 8px', background: viewMode === 'table' ? c.contentBorder : 'transparent', color: viewMode === 'table' ? c.headingColor : c.mutedText }}
          ><List size={15} /></button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ marginTop: 16 }}>
        {loading && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>No public routes in this library</div>
        ) : viewMode === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {items.map((item) => (
              <PublicRouteCard key={item.id} item={item} onStar={() => handleStar(item.id, !!item.starred)} onClick={() => setSelectedRoute(item)} />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', background: c.contentBg, borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}></th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('name')}>Name{sortArrow('name')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Author</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('distance')}>Distance{sortArrow('distance')}</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('elevation')}>Elevation{sortArrow('elevation')}</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('flatness')}>Flatness{sortArrow('flatness')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${c.contentBorder}`, fontSize: '0.75rem', fontWeight: 600, color: c.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setSelectedRoute(item)}>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleStar(item.id, !!item.starred)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                      <Star size={14} fill={item.starred ? '#f0b232' : 'none'} color={item.starred ? '#f0b232' : '#ccc'} />
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap' }}>{item.author?.displayName || ''}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap' }}>{item.category?.name || ''}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap' }}>{activityLabel(item.activityType) || ''}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap', textAlign: 'right' }}>{formatDistance(item.distanceKm)}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap', textAlign: 'right' }}>{item.elevationGainM != null ? `+${formatElevation(item.elevationGainM)}` : '--'}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap', textAlign: 'right' }}>{item.flatness != null ? formatFlatness(item.flatness) : '--'}</td>
                  <td style={{ padding: '10px 12px', color: c.pageText, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <a href={item.url} download={item.originalName} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', color: c.accent, textDecoration: 'none' }}><Download size={13} /></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail overlay */}
      {selectedRoute && (
        <RouteDetailOverlay
          item={{ ...selectedRoute, channelName: channelName }}
          spaceSlug={spaceSlug!}
          onClose={() => setSelectedRoute(null)}
          onStar={() => handleStar(selectedRoute.id, !!selectedRoute.starred)}
        />
      )}
    </div>
  );
}

function PublicRouteCard({ item, onStar, onClick }: { item: RouteItem; onStar: () => void; onClick: () => void }) {
  const theme = usePublicTheme();
  const c = theme.colors;
  const polyline = useMemo(() => generateMiniMapPoints(item.geojson, 200, 120), [item.geojson]);

  return (
    <div style={{ background: c.contentBg, border: `1px solid ${c.contentBorder}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, cursor: 'pointer' }} onClick={onClick} role="button" tabIndex={0}>
      <div style={{ height: 120, background: '#f3f4f6', overflow: 'hidden' }}>
        <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
          <polyline
            points={polyline}
            fill="none"
            stroke={c.accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
        <a href={item.url} download={item.originalName} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', color: c.accent, textDecoration: 'none' }}>
          <Download size={13} /> Download GPX
        </a>
      </div>
    </div>
  );
}
