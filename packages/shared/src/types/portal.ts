export type PortalInviteStatus = 'pending' | 'accepted' | 'rejected';

export interface Portal {
  id: string;
  channelId: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  createdBy: string;
  createdAt: string;
}

export interface PortalInvite {
  id: string;
  channelId: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  requestedBy: string;
  status: PortalInviteStatus;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface EligibleSpace {
  id: string;
  name: string;
  iconUrl: string | null;
  canCreateDirectly: boolean;
  canSubmitInvite: boolean;
}
