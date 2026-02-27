// ─── Newsletter Block Types ───

export interface TextBlock {
  type: 'text';
  content: string; // markdown
}

export interface ImageBlock {
  type: 'image';
  url: string;
  caption?: string | null;
  alt?: string | null;
}

export interface ImageGalleryBlock {
  type: 'image_gallery';
  images: { url: string; caption?: string | null; alt?: string | null }[];
}

export interface QuoteBlock {
  type: 'quote';
  content: string;
  attribution?: string | null;
}

export interface DividerBlock {
  type: 'divider';
}

export interface EmbedBlock {
  type: 'embed';
  url: string;
  title?: string | null;
}

export interface SectionHeadingBlock {
  type: 'section_heading';
  content: string;
}

export type NewsletterBlock =
  | TextBlock
  | ImageBlock
  | ImageGalleryBlock
  | QuoteBlock
  | DividerBlock
  | EmbedBlock
  | SectionHeadingBlock;

// ─── Newsletter ───

export interface Newsletter {
  id: string;
  spaceId: string | null;
  authorId: string;
  subject: string;
  summary: string | null;
  headerImageUrl: string | null;
  blocks: NewsletterBlock[];
  status: 'draft' | 'published';
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

// ─── Subscriptions ───

export type SubscriptionFrequency = 'immediate' | 'daily_digest' | 'weekly_digest';
export type SubscriptionSourceType = 'space' | 'user';

export interface NewsletterSubscription {
  id: string;
  userId: string;
  sourceType: SubscriptionSourceType;
  sourceId: string;
  frequency: SubscriptionFrequency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  sourceName?: string;
  sourceSlug?: string;
  sourceIconUrl?: string | null;
}

export interface SubscriptionPreferences {
  subscriptions: NewsletterSubscription[];
}

// ─── Stats ───

export interface NewsletterStats {
  newsletterId: string;
  subject: string;
  publishedAt: string | null;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
}

export interface NewsletterSendStatus {
  id: string;
  email: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'complained';
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickCount: number;
}
