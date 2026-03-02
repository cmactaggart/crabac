import type { Reaction } from '@crabac/shared';

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggleReaction: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onToggleReaction }: ReactionBarProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div style={styles.reactions}>
      {reactions.map((reaction) => {
        const hasReacted = reaction.users.some((u) => u.id === currentUserId);
        return (
          <button
            key={reaction.emoji}
            style={{
              ...styles.reactionChip,
              borderColor: hasReacted ? 'var(--accent)' : 'var(--border)',
              background: hasReacted ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-secondary)',
            }}
            onClick={() => onToggleReaction(reaction.emoji)}
            title={reaction.users.map((u) => u.username).join(', ')}
          >
            <span>{reaction.emoji}</span>
            <span style={{ fontSize: '0.75rem', color: hasReacted ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {reaction.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  reactions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    paddingLeft: 48,
    marginTop: 4,
  },
  reactionChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
};
