import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useCallStore } from '../stores/call.js';
import { useAuthStore } from '../stores/auth.js';
import type { Call } from '@crabac/shared';

/**
 * Global call socket listener — mount once at app level.
 * Handles incoming calls, call ended, participant join/leave events.
 */
export function useCallSocket() {
  const handleIncomingCall = useCallStore((s) => s.handleIncomingCall);
  const handleCallEnded = useCallStore((s) => s.handleCallEnded);
  const handleParticipantJoined = useCallStore((s) => s.handleParticipantJoined);
  const handleParticipantLeft = useCallStore((s) => s.handleParticipantLeft);
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentUserId) return;

    const onRinging = ({ call, conversationId }: { call: Call; conversationId: string }) => {
      handleIncomingCall(call, conversationId);
    };

    const onEnded = ({ call }: { call: Call }) => {
      handleCallEnded(call.id);
    };

    const onParticipantJoined = ({ call }: { call: Call }) => {
      handleParticipantJoined(call);
    };

    const onParticipantLeft = ({ call, userId }: { call: Call; userId: string }) => {
      handleParticipantLeft(call, userId);
    };

    const onParticipantDeclined = ({ call }: { call: Call }) => {
      // Update call state (someone declined)
      handleParticipantJoined(call); // reuses same logic — just refreshes call data
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:ended', onEnded);
    socket.on('call:participant_joined', onParticipantJoined);
    socket.on('call:participant_left', onParticipantLeft);
    socket.on('call:participant_declined', onParticipantDeclined);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:ended', onEnded);
      socket.off('call:participant_joined', onParticipantJoined);
      socket.off('call:participant_left', onParticipantLeft);
      socket.off('call:participant_declined', onParticipantDeclined);
    };
  }, [currentUserId, handleIncomingCall, handleCallEnded, handleParticipantJoined, handleParticipantLeft]);
}
