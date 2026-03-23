import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useCallStore } from '../stores/call.js';
import { useAuthStore } from '../stores/auth.js';
import { fireNotification } from '../lib/notifications.js';
import { useToastStore } from '../stores/toast.js';
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

      // Browser notification for unfocused tab
      const caller = call.participants.find((p) => p.userId === call.initiatedBy);
      const callerName = caller?.displayName || caller?.username || 'Someone';
      fireNotification(`${callerName} is calling`, 'Incoming call — tap to answer');
    };

    const addToast = useToastStore.getState().addToast;

    const onEnded = ({ call }: { call: Call }) => {
      handleCallEnded(call.id);
      addToast('Call ended');
    };

    const onParticipantJoined = ({ call }: { call: Call }) => {
      handleParticipantJoined(call);
      // Only toast if we're in this call
      const active = useCallStore.getState().activeCall;
      if (active?.id === call.id) {
        const newest = call.participants.find((p) => p.status === 'joined' && p.userId !== currentUserId);
        if (newest) {
          addToast(`${newest.displayName || newest.username} joined the call`, 'success');
        }
      }
    };

    const onParticipantLeft = ({ call, userId }: { call: Call; userId: string }) => {
      handleParticipantLeft(call, userId);
      const active = useCallStore.getState().activeCall;
      if (active?.id === call.id) {
        const who = call.participants.find((p) => p.userId === userId);
        if (who) {
          addToast(`${who.displayName || who.username} left the call`);
        }
      }
    };

    const onParticipantDeclined = ({ call }: { call: Call }) => {
      // Update call state (someone declined)
      handleParticipantJoined(call); // reuses same logic — just refreshes call data
    };

    // Dismiss incoming call on other devices when accepted/declined elsewhere
    const onAnsweredElsewhere = ({ callId }: { callId: string }) => {
      const incoming = useCallStore.getState().incomingCall;
      if (incoming?.id === callId) {
        useCallStore.getState().dismissIncoming();
      }
    };

    const onDeclinedElsewhere = ({ callId }: { callId: string }) => {
      const incoming = useCallStore.getState().incomingCall;
      if (incoming?.id === callId) {
        useCallStore.getState().dismissIncoming();
      }
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:ended', onEnded);
    socket.on('call:participant_joined', onParticipantJoined);
    socket.on('call:participant_left', onParticipantLeft);
    socket.on('call:participant_declined', onParticipantDeclined);
    socket.on('call:answered_elsewhere', onAnsweredElsewhere);
    socket.on('call:declined_elsewhere', onDeclinedElsewhere);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:ended', onEnded);
      socket.off('call:participant_joined', onParticipantJoined);
      socket.off('call:participant_left', onParticipantLeft);
      socket.off('call:participant_declined', onParticipantDeclined);
      socket.off('call:answered_elsewhere', onAnsweredElsewhere);
      socket.off('call:declined_elsewhere', onDeclinedElsewhere);
    };
  }, [currentUserId, handleIncomingCall, handleCallEnded, handleParticipantJoined, handleParticipantLeft]);
}
