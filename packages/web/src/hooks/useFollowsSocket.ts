import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useFollowsStore } from '../stores/follows.js';

export function useFollowsSocket() {
  const handleRequestReceived = useFollowsStore((s) => s.handleRequestReceived);
  const handleAccepted = useFollowsStore((s) => s.handleAccepted);
  const handleNewFollower = useFollowsStore((s) => s.handleNewFollower);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('follow:request_received', handleRequestReceived);
    socket.on('follow:accepted', handleAccepted);
    socket.on('follow:new_follower', handleNewFollower);

    return () => {
      socket.off('follow:request_received', handleRequestReceived);
      socket.off('follow:accepted', handleAccepted);
      socket.off('follow:new_follower', handleNewFollower);
    };
  }, [handleRequestReceived, handleAccepted, handleNewFollower]);
}
