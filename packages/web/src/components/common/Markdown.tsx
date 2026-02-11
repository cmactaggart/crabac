import { Fragment, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useNavigate } from 'react-router-dom';
import type { Components } from 'react-markdown';
import { useChannelsStore } from '../../stores/channels.js';

interface Props {
  content: string;
}

function renderMentionsAndChannels(text: string, navigate: (path: string) => void, channels: { id: string; spaceId: string; name: string }[]) {
  const parts = text.split(/(@(?:everyone|here|[a-zA-Z0-9_-]+)|#[a-z0-9][a-z0-9-]*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.match(/^@(?:everyone|here|[a-zA-Z0-9_-]+)$/)) {
      return (
        <span
          key={i}
          style={{
            background: 'rgba(88, 101, 242, 0.15)',
            color: 'var(--accent)',
            fontWeight: 600,
            padding: '0 2px',
            borderRadius: 3,
          }}
        >
          {part}
        </span>
      );
    }
    if (part.match(/^#[a-z0-9][a-z0-9-]*$/)) {
      const channelName = part.slice(1);
      const channel = channels.find((ch) => ch.name === channelName);
      if (channel) {
        return (
          <span
            key={i}
            role="link"
            onClick={() => navigate(`/space/${channel.spaceId}/channel/${channel.id}`)}
            style={{
              background: 'rgba(88, 101, 242, 0.15)',
              color: 'var(--accent)',
              fontWeight: 600,
              padding: '0 2px',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {part}
          </span>
        );
      }
      return (
        <span
          key={i}
          style={{
            background: 'rgba(88, 101, 242, 0.15)',
            color: 'var(--accent)',
            fontWeight: 600,
            padding: '0 2px',
            borderRadius: 3,
          }}
        >
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function makeComponents(navigate: (path: string) => void, channels: { id: string; spaceId: string; name: string }[]): Components {
  const renderInline = (text: string) => renderMentionsAndChannels(text, navigate, channels);

  return {
    // Inline code
    code({ children, className }) {
      const isBlock = className?.startsWith('language-');
      if (isBlock) {
        return (
          <pre style={styles.codeBlock}>
            <code>{children}</code>
          </pre>
        );
      }
      return <code style={styles.inlineCode}>{children}</code>;
    },
    pre({ children }) {
      return <>{children}</>;
    },
    // Links — internal links stay in SPA, external open in new tab
    a({ href, children }) {
      const isInternal = href && (
        href.startsWith('/') ||
        href.startsWith(window.location.origin)
      );
      return (
        <a
          href={href}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          style={isInternal ? styles.internalLink : styles.link}
        >
          {children}
        </a>
      );
    },
    // Block elements
    p({ children }) {
      const processChildren = (nodes: React.ReactNode): React.ReactNode => {
        if (typeof nodes === 'string') return renderInline(nodes);
        if (Array.isArray(nodes)) return nodes.map((n, i) => <Fragment key={i}>{processChildren(n)}</Fragment>);
        return nodes;
      };
      return <p style={styles.paragraph}>{processChildren(children)}</p>;
    },
    blockquote({ children }) {
      return <blockquote style={styles.blockquote}>{children}</blockquote>;
    },
    ul({ children }) {
      return <ul style={styles.list}>{children}</ul>;
    },
    ol({ children }) {
      return <ol style={styles.list}>{children}</ol>;
    },
    li({ children }) {
      return <li style={styles.listItem}>{children}</li>;
    },
    h1({ children }) {
      return <strong style={styles.heading}>{children}</strong>;
    },
    h2({ children }) {
      return <strong style={styles.heading}>{children}</strong>;
    },
    h3({ children }) {
      return <strong style={styles.heading}>{children}</strong>;
    },
    hr() {
      return <hr style={styles.hr} />;
    },
    table({ children }) {
      return (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>{children}</table>
        </div>
      );
    },
    th({ children }) {
      return <th style={styles.th}>{children}</th>;
    },
    td({ children }) {
      return <td style={styles.td}>{children}</td>;
    },
    img({ src, alt }) {
      return <img src={src} alt={alt} style={styles.img} />;
    },
  };
}

export function Markdown({ content }: Props) {
  const navigate = useNavigate();
  const channels = useChannelsStore((s) => s.channels);
  const components = useMemo(() => makeComponents(navigate, channels), [navigate, channels]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}

const styles: Record<string, React.CSSProperties> = {
  paragraph: {
    margin: 0,
  },
  inlineCode: {
    background: 'var(--bg-tertiary)',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: '0.85em',
    fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
  },
  codeBlock: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px 12px',
    margin: '4px 0',
    fontSize: '0.85rem',
    fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
    overflowX: 'auto',
    whiteSpace: 'pre',
    lineHeight: 1.5,
  },
  link: {
    color: 'var(--accent)',
    textDecoration: 'none',
  },
  internalLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  blockquote: {
    borderLeft: '3px solid var(--accent)',
    margin: '4px 0',
    padding: '2px 12px',
    color: 'var(--text-secondary)',
  },
  list: {
    margin: '2px 0',
    paddingLeft: 20,
  },
  listItem: {
    margin: '1px 0',
  },
  heading: {
    display: 'block',
    fontSize: '1rem',
    margin: '4px 0 2px',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid var(--border)',
    margin: '6px 0',
  },
  tableWrapper: {
    overflowX: 'auto',
    margin: '4px 0',
  },
  table: {
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    border: '1px solid var(--border)',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    fontWeight: 600,
    textAlign: 'left' as const,
  },
  td: {
    border: '1px solid var(--border)',
    padding: '4px 8px',
  },
  img: {
    maxWidth: 400,
    maxHeight: 300,
    borderRadius: 'var(--radius)',
  },
};
