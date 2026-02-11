import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useFriendsStore } from '../stores/friends.js';

export function useFriendsSocket() {
  const handleRequestReceived = useFriendsStore((s) => s.handleRequestReceived);
  const handleAccepted = useFriendsStore((s) => s.handleAccepted);
  const handleRemoved = useFriendsStore((s) => s.handleRemoved);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('friend:request_received', handleRequestReceived);
    socket.on('friend:accepted', handleAccepted);
    socket.on('friend:removed', handleRemoved);

    return () => {
      socket.off('friend:request_received', handleRequestReceived);
      socket.off('friend:accepted', handleAccepted);
      socket.off('friend:removed', handleRemoved);
    };
  }, [handleRequestReceived, handleAccepted, handleRemoved]);
}
