import { useState } from 'react';
import { useFollowsStore } from '../../stores/follows.js';
import { useDMStore } from '../../stores/dm.js';
import { usePortalsStore } from '../../stores/portals.js';
import { useNotificationsStore } from '../../stores/notifications.js';
import type { Notification } from '@crabac/shared';

type ActionResult = 'accepted' | 'rejected' | null;

interface Props {
  notification: Notification;
}

export function NotificationActions({ notification }: Props) {
  const [result, setResult] = useState<ActionResult>(null);
  const [loading, setLoading] = useState(false);
  const data = notification.data as any;
  const resolvedStatus = notification.resolvedStatus;

  const acceptFollowRequest = useFollowsStore((s) => s.acceptFollowRequest);
  const declineFollowRequest = useFollowsStore((s) => s.declineFollowRequest);
  const acceptMessageRequest = useDMStore((s) => s.acceptMessageRequest);
  const declineMessageRequest = useDMStore((s) => s.declineMessageRequest);
  const acceptPortalInvite = usePortalsStore((s) => s.acceptInvite);
  const rejectPortalInvite = usePortalsStore((s) => s.rejectInvite);
  const markAsRead = useNotificationsStore((s) => s.markAsRead);

  // If already resolved server-side, show the resolved state
  if (resolvedStatus && resolvedStatus !== 'pending') {
    return (
      <div style={styles.result}>
        {resolvedStatus === 'accepted' ? 'Accepted' : 'Rejected'}
      </div>
    );
  }

  const handleAction = async (action: 'accept' | 'reject') => {
    setLoading(true);
    try {
      if (notification.type === 'follow_request') {
        if (action === 'accept') await acceptFollowRequest(data.fromUserId);
        else await declineFollowRequest(data.fromUserId);
      } else if (notification.type === 'dm_request') {
        if (action === 'accept') await acceptMessageRequest(data.conversationId);
        else await declineMessageRequest(data.conversationId);
      } else if (notification.type === 'portal_invite') {
        if (action === 'accept') await acceptPortalInvite(data.targetSpaceId, data.inviteId);
        else await rejectPortalInvite(data.targetSpaceId, data.inviteId);
      }
      setResult(action === 'accept' ? 'accepted' : 'rejected');
      if (!notification.read) markAsRead(notification.id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const getProfileUsername = (): string | null => {
    if (notification.type === 'follow_request' || notification.type === 'dm_request') {
      return data.fromUsername;
    }
    if (notification.type === 'portal_invite') {
      return data.requestedByUsername;
    }
    return null;
  };

  if (result) {
    return (
      <div style={styles.result}>
        {result === 'accepted' ? 'Accepted' : 'Rejected'}
      </div>
    );
  }

  const username = getProfileUsername();

  return (
    <div style={styles.actions} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => handleAction('accept')}
        disabled={loading}
        style={styles.acceptBtn}
      >
        Accept
      </button>
      <button
        onClick={() => handleAction('reject')}
        disabled={loading}
        style={styles.rejectBtn}
      >
        Reject
      </button>
      {username && (
        <button
          onClick={() => window.open(`/p/${username}`, '_blank')}
          disabled={loading}
          style={styles.profileBtn}
        >
          View Profile
        </button>
      )}
    </div>
  );
}

export function isActionableNotification(type: string): boolean {
  return type === 'follow_request' || type === 'dm_request' || type === 'portal_invite';
}

const styles: Record<string, React.CSSProperties> = {
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  },
  acceptBtn: {
    padding: '2px 10px',
    fontSize: '0.72rem',
    fontWeight: 600,
    borderRadius: 4,
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '2px 10px',
    fontSize: '0.72rem',
    fontWeight: 600,
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  profileBtn: {
    padding: '2px 10px',
    fontSize: '0.72rem',
    fontWeight: 600,
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  result: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginTop: 6,
    fontStyle: 'italic',
  },
};
