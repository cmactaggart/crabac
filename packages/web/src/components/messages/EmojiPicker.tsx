import { useState, useEffect, useRef, useMemo } from 'react';

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const RECENT_KEY = 'gud_recent_emojis';
const MAX_RECENT = 16;

const CATEGORIES: Record<string, string[]> = {
  'Recently Used': [], // filled dynamically
  'Smileys': [
    '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', '\u{1F605}', '\u{1F602}', '\u{1F923}',
    '\u{1F60A}', '\u{1F607}', '\u{1F642}', '\u{1F643}', '\u{1F609}', '\u{1F60C}', '\u{1F60D}', '\u{1F970}',
    '\u{1F618}', '\u{1F617}', '\u{1F619}', '\u{1F61A}', '\u{1F60B}', '\u{1F61B}', '\u{1F61C}', '\u{1F92A}',
    '\u{1F61D}', '\u{1F911}', '\u{1F917}', '\u{1F92D}', '\u{1F92B}', '\u{1F914}', '\u{1F910}', '\u{1F928}',
    '\u{1F610}', '\u{1F611}', '\u{1F636}', '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F925}',
    '\u{1F60C}', '\u{1F614}', '\u{1F62A}', '\u{1F924}', '\u{1F634}', '\u{1F637}', '\u{1F912}', '\u{1F915}',
    '\u{1F922}', '\u{1F92E}', '\u{1F927}', '\u{1F975}', '\u{1F976}', '\u{1F974}', '\u{1F635}', '\u{1F92F}',
    '\u{1F920}', '\u{1F973}', '\u{1F978}', '\u{1F60E}', '\u{1F913}', '\u{1F9D0}', '\u{1F615}', '\u{1F61F}',
    '\u{1F641}', '\u{2639}\u{FE0F}', '\u{1F62E}', '\u{1F62F}', '\u{1F632}', '\u{1F633}', '\u{1F97A}', '\u{1F626}',
    '\u{1F627}', '\u{1F628}', '\u{1F630}', '\u{1F625}', '\u{1F622}', '\u{1F62D}', '\u{1F631}', '\u{1F616}',
    '\u{1F623}', '\u{1F61E}', '\u{1F613}', '\u{1F629}', '\u{1F62B}', '\u{1F971}', '\u{1F624}', '\u{1F621}',
    '\u{1F620}', '\u{1F92C}', '\u{1F608}', '\u{1F47F}', '\u{1F480}', '\u{2620}\u{FE0F}', '\u{1F4A9}', '\u{1F921}',
  ],
  'Gestures': [
    '\u{1F44D}', '\u{1F44E}', '\u{1F44A}', '\u{270A}', '\u{1F91B}', '\u{1F91C}', '\u{1F44F}', '\u{1F64C}',
    '\u{1F450}', '\u{1F932}', '\u{1F91D}', '\u{1F64F}', '\u{270D}\u{FE0F}', '\u{1F485}', '\u{1F933}', '\u{1F4AA}',
    '\u{1F9BE}', '\u{1F9BF}', '\u{1F448}', '\u{1F449}', '\u{261D}\u{FE0F}', '\u{1F446}', '\u{1F447}', '\u{270B}',
    '\u{1F91A}', '\u{1F590}\u{FE0F}', '\u{1F596}', '\u{1F44C}', '\u{1F90C}', '\u{1F90F}', '\u{270C}\u{FE0F}', '\u{1F91E}',
    '\u{1F91F}', '\u{1F918}', '\u{1F919}', '\u{1F44B}', '\u{1F919}', '\u{1F4AA}', '\u{1F9B5}', '\u{1F9B6}',
  ],
  'Hearts': [
    '\u{2764}\u{FE0F}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}', '\u{1F49C}', '\u{1F5A4}', '\u{1FA76}',
    '\u{1F90D}', '\u{1F90E}', '\u{1F494}', '\u{2763}\u{FE0F}', '\u{1F495}', '\u{1F49E}', '\u{1F493}', '\u{1F497}',
    '\u{1F496}', '\u{1F498}', '\u{1F49D}', '\u{1F49F}', '\u{1F48C}', '\u{1F48B}', '\u{1F48D}',
  ],
  'Animals': [
    '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}', '\u{1F43B}', '\u{1F43C}',
    '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}', '\u{1F437}', '\u{1F438}', '\u{1F435}', '\u{1F648}',
    '\u{1F649}', '\u{1F64A}', '\u{1F412}', '\u{1F414}', '\u{1F427}', '\u{1F426}', '\u{1F985}', '\u{1F989}',
    '\u{1F987}', '\u{1F43A}', '\u{1F417}', '\u{1F434}', '\u{1F984}', '\u{1F41D}', '\u{1F41B}', '\u{1F98B}',
    '\u{1F40C}', '\u{1F41A}', '\u{1F41E}', '\u{1F41C}', '\u{1F997}', '\u{1F577}\u{FE0F}', '\u{1F578}\u{FE0F}', '\u{1F982}',
    '\u{1F422}', '\u{1F40D}', '\u{1F98E}', '\u{1F996}', '\u{1F995}', '\u{1F419}', '\u{1F991}', '\u{1F990}',
    '\u{1F980}', '\u{1F421}', '\u{1F420}', '\u{1F41F}', '\u{1F42C}', '\u{1F433}', '\u{1F40B}', '\u{1F988}',
    '\u{1F40A}', '\u{1F405}', '\u{1F406}', '\u{1F993}', '\u{1F98D}', '\u{1F9A7}', '\u{1F418}', '\u{1F98F}',
  ],
  'Food': [
    '\u{1F34E}', '\u{1F34F}', '\u{1F350}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}', '\u{1F349}', '\u{1F347}',
    '\u{1F353}', '\u{1FAD0}', '\u{1F348}', '\u{1F352}', '\u{1F351}', '\u{1F96D}', '\u{1F34D}', '\u{1F965}',
    '\u{1F95D}', '\u{1F345}', '\u{1F346}', '\u{1F951}', '\u{1F966}', '\u{1F96C}', '\u{1F952}', '\u{1F336}\u{FE0F}',
    '\u{1F33D}', '\u{1F955}', '\u{1F954}', '\u{1F360}', '\u{1F950}', '\u{1F35E}', '\u{1F956}', '\u{1F968}',
    '\u{1F96F}', '\u{1F9C0}', '\u{1F356}', '\u{1F357}', '\u{1F969}', '\u{1F953}', '\u{1F354}', '\u{1F35F}',
    '\u{1F355}', '\u{1F32D}', '\u{1F96A}', '\u{1F32E}', '\u{1F32F}', '\u{1F959}', '\u{1F9C6}', '\u{1F95A}',
    '\u{1F373}', '\u{1F958}', '\u{1F372}', '\u{1F35C}', '\u{1F363}', '\u{1F371}', '\u{1F35B}', '\u{1F35A}',
    '\u{1F364}', '\u{1F370}', '\u{1F382}', '\u{1F967}', '\u{1F9C1}', '\u{1F366}', '\u{1F367}', '\u{1F368}',
  ],
  'Activities': [
    '\u{26BD}', '\u{1F3C0}', '\u{1F3C8}', '\u{26BE}', '\u{1F94E}', '\u{1F3BE}', '\u{1F3D0}', '\u{1F3C9}',
    '\u{1F94F}', '\u{1F3B1}', '\u{1F3D3}', '\u{1F3F8}', '\u{1F945}', '\u{1F3D2}', '\u{1F94D}', '\u{1F3CF}',
    '\u{26F3}', '\u{1F94C}', '\u{1F3F9}', '\u{1F3A3}', '\u{1F93F}', '\u{1F94A}', '\u{1F94B}', '\u{1F3BD}',
    '\u{26F8}\u{FE0F}', '\u{1F6F7}', '\u{1F3BF}', '\u{26F7}\u{FE0F}', '\u{1F3C2}', '\u{1F3CB}\u{FE0F}', '\u{1F93C}', '\u{1F938}',
    '\u{1F3AE}', '\u{1F3B2}', '\u{1F3B0}', '\u{1F3AF}', '\u{265F}\u{FE0F}', '\u{1F9E9}', '\u{1F3AD}', '\u{1F3A8}',
    '\u{1F3B5}', '\u{1F3B6}', '\u{1F3A4}', '\u{1F3A7}', '\u{1F3B8}', '\u{1F3B9}', '\u{1F941}', '\u{1F3BA}',
  ],
  'Objects': [
    '\u{1F4F1}', '\u{1F4BB}', '\u{2328}\u{FE0F}', '\u{1F5A5}\u{FE0F}', '\u{1F5A8}\u{FE0F}', '\u{1F4F7}', '\u{1F4F8}', '\u{1F3A5}',
    '\u{1F4FD}\u{FE0F}', '\u{1F4FA}', '\u{1F4FB}', '\u{23F0}', '\u{231A}', '\u{1F4A1}', '\u{1F50E}', '\u{1F52C}',
    '\u{1F52D}', '\u{1F6E0}\u{FE0F}', '\u{1F527}', '\u{1F529}', '\u{2699}\u{FE0F}', '\u{1F5DC}\u{FE0F}', '\u{2696}\u{FE0F}', '\u{1F517}',
    '\u{26D3}\u{FE0F}', '\u{1F4CE}', '\u{1F4CB}', '\u{1F4CC}', '\u{1F4CF}', '\u{1F4D0}', '\u{2702}\u{FE0F}', '\u{1F4E6}',
    '\u{1F4E8}', '\u{1F4E9}', '\u{1F4EA}', '\u{1F4EB}', '\u{1F4EC}', '\u{1F4ED}', '\u{1F4EE}', '\u{1F4EF}',
    '\u{1F4DC}', '\u{1F4C3}', '\u{1F4D1}', '\u{1F4CA}', '\u{1F4C8}', '\u{1F4C9}', '\u{1F4C6}', '\u{1F4C5}',
    '\u{1F4D3}', '\u{1F4D4}', '\u{1F4D5}', '\u{1F4D7}', '\u{1F4D8}', '\u{1F4D9}', '\u{1F4DA}', '\u{1F4D6}',
    '\u{1F513}', '\u{1F512}', '\u{1F511}', '\u{1F5DD}\u{FE0F}',
  ],
  'Symbols': [
    '\u{2764}\u{FE0F}\u{200D}\u{1F525}', '\u{2728}', '\u{1F31F}', '\u{1F4AB}', '\u{1F4A5}', '\u{1F525}', '\u{1F4AF}', '\u{1F4A2}',
    '\u{1F4A8}', '\u{1F4A6}', '\u{1F573}\u{FE0F}', '\u{1F4A3}', '\u{1F4AC}', '\u{1F441}\u{FE0F}\u{200D}\u{1F5E8}\u{FE0F}', '\u{1F5E8}\u{FE0F}', '\u{1F5EF}\u{FE0F}',
    '\u{1F4AD}', '\u{1F4A4}', '\u{2705}', '\u{274C}', '\u{274E}', '\u{2757}', '\u{2753}', '\u{2754}',
    '\u{2755}', '\u{1F4E2}', '\u{1F4E3}', '\u{1F508}', '\u{1F509}', '\u{1F50A}', '\u{1F514}', '\u{1F515}',
    '\u{267B}\u{FE0F}', '\u{1F4B0}', '\u{1F48E}', '\u{269B}\u{FE0F}', '\u{1F6AB}', '\u{1F3F3}\u{FE0F}', '\u{1F3F4}', '\u{2620}\u{FE0F}',
  ],
  'Flags': [
    '\u{1F1FA}\u{1F1F8}', '\u{1F1EC}\u{1F1E7}', '\u{1F1E9}\u{1F1EA}', '\u{1F1EB}\u{1F1F7}', '\u{1F1EF}\u{1F1F5}', '\u{1F1E8}\u{1F1E6}', '\u{1F1E6}\u{1F1FA}', '\u{1F1E7}\u{1F1F7}',
    '\u{1F1EE}\u{1F1F3}', '\u{1F1F0}\u{1F1F7}', '\u{1F1EE}\u{1F1F9}', '\u{1F1EA}\u{1F1F8}', '\u{1F1F2}\u{1F1FD}', '\u{1F1F7}\u{1F1FA}', '\u{1F1E8}\u{1F1F3}', '\u{1F1F8}\u{1F1EA}',
  ],
};

function getRecentEmojis(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentEmoji(emoji: string) {
  const recent = getRecentEmojis().filter((e) => e !== emoji);
  recent.unshift(emoji);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const pickerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recentEmojis = useMemo(getRecentEmojis, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleSelect = (emoji: string) => {
    addRecentEmoji(emoji);
    onSelect(emoji);
  };

  // All emojis flat for search
  const allEmojis = useMemo(() => {
    const all: string[] = [];
    for (const [cat, emojis] of Object.entries(CATEGORIES)) {
      if (cat === 'Recently Used') continue;
      all.push(...emojis);
    }
    return all;
  }, []);

  const categoryNames = Object.keys(CATEGORIES).filter((c) =>
    c === 'Recently Used' ? recentEmojis.length > 0 : true,
  );

  return (
    <div ref={pickerRef} style={styles.picker}>
      {/* Search */}
      <div style={styles.searchRow}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          style={styles.searchInput}
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div style={styles.tabs}>
          {categoryNames.map((cat) => (
            <button
              key={cat}
              style={{
                ...styles.tab,
                color: cat === activeCategory ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: cat === activeCategory ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onClick={() => {
                setActiveCategory(cat);
                const el = document.getElementById(`emoji-cat-${cat}`);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {cat.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div ref={scrollRef} style={styles.grid}>
        {search ? (
          // Search results — just show all emojis (no good way to search by name w/o a mapping)
          <div style={styles.emojiRow}>
            {allEmojis.map((emoji, i) => (
              <button key={i} style={styles.emojiBtn} onClick={() => handleSelect(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          categoryNames.map((cat) => {
            const emojis = cat === 'Recently Used' ? recentEmojis : CATEGORIES[cat];
            if (emojis.length === 0) return null;
            return (
              <div key={cat} id={`emoji-cat-${cat}`}>
                <div style={styles.catLabel}>{cat}</div>
                <div style={styles.emojiRow}>
                  {emojis.map((emoji, i) => (
                    <button key={i} style={styles.emojiBtn} onClick={() => handleSelect(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  picker: {
    position: 'absolute',
    right: 0,
    top: -360,
    width: 320,
    height: 350,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  searchRow: {
    padding: '8px 8px 4px',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    outline: 'none',
  },
  tabs: {
    display: 'flex',
    padding: '0 4px',
    gap: 0,
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    overflowX: 'auto',
  },
  tab: {
    background: 'none',
    border: 'none',
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 8px',
  },
  catLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    padding: '6px 0 2px',
  },
  emojiRow: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.3rem',
    cursor: 'pointer',
    padding: '3px',
    borderRadius: 4,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
