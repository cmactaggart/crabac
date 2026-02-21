export interface MobileBundle {
  id: string;
  platform: 'ios' | 'android';
  bundleVersion: number;
  nativeVersion: string;
  filePath: string;
  checksum: string;
  fileSize: number;
  status: 'active' | 'inactive';
  isRequired: boolean;
  releaseNotes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface MobileBundleUpdateCheck {
  id: string;
  bundleVersion: number;
  nativeVersion: string;
  checksum: string;
  fileSize: number;
  downloadUrl: string;
  isRequired: boolean;
  releaseNotes: string | null;
}
