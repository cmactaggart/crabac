export interface GalleryItem {
  id: string;
  channelId: string;
  authorId: string;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
  };
  attachments: GalleryAttachment[];
}

export interface GalleryAttachment {
  id: string;
  galleryItemId: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  position: number;
}
