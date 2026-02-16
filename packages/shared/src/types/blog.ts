export interface BlogPost {
  id: string;
  spaceId: string;
  authorId: string;
  title: string;
  summary: string | null;
  content: string;
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
