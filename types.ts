

export enum AssetType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  WEBSITE = 'WEBSITE',
  YOUTUBE = 'YOUTUBE',
}

export enum AssetScale {
  FIT = 'FIT',
  FILL = 'FILL',
  STRETCH = 'STRETCH',
  NONE = 'NONE'
}

export interface Asset {
  id: string;
  type: AssetType;
  url: string; // URL or Base64 data
  name: string;
  duration: number; // in seconds
  thumbnail?: string;
  // overlay removed from Asset
  scale?: AssetScale;
  playUntilDone?: boolean;
  offsetX?: number; // percentage (-100 to 100)
  offsetY?: number; // percentage (-100 to 100)
  youtubeScale?: number; // scale multiplier (0.1 to 5.0)
  muted?: boolean;
}

export interface PlaylistData {
  assets: Asset[];
}

export interface Group {
  id: string;
  name: string;
  playlist: Asset[];
  campaignId?: string | null;
  overlay?: string; 
  overlayX?: number;
  overlayY?: number;
  overlayW?: number;
  overlayH?: number;
  ownerId?: string;
}

export interface LayoutZone {
  id: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  w: number; // percentage (0-100)
  h: number; // percentage (0-100)
}

export interface Layout {
  id: string;
  name: string;
  zones: LayoutZone[];
  isSystem?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  layoutId: string;
  zonePlaylists: Record<string, Asset[]>;
  ownerId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  assets: Asset[];
  ownerId?: string;
}

export interface Device {
  id: string;
  name: string;
  pairingCode: string;
  isRegistered: boolean;
  lastSeen: number;
  playlist: Asset[];
  groupId?: string; // If present, device inherits group playlist
  rotation: number; // 0, 90, 180, 270
  overlay?: string; // Global overlay for this device (overrides group?)
  overlayX?: number;
  overlayY?: number;
  overlayW?: number;
  overlayH?: number;
  ownerId?: string; // ID of the user who owns this device
  currentAssetId?: string; // ID of the asset currently being displayed
  lastReloadTime?: number; // Timestamp of the last remote reload command
  playlistHash?: string; // Optimization: backend hash of the current playlist
  playlistUnchanged?: boolean; // Optimization: signals the frontend to keep existing playlist
  resolution?: string;
  userAgent?: string;
  zoom?: number;
  campaignId?: string;
  campaign?: Campaign;
  layout?: Layout;
}

// --- Auth & Admin Types ---

export enum UserRole {
  ADMIN = 'ADMIN',
  OWNER = 'OWNER'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: number;
  password?: string; // Only used for updates, not stored in state usually
  isTempPassword?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userEmail: string;
  action: string;
  details: string;
}

export interface SystemConfig {
  allowOwnerEdit: boolean;
  mailHost?: string;
  mailPort?: number;
  mailUser?: string;
  mailPass?: string;
  mailFrom?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

export const DEFAULT_ASSETS: Asset[] = [
  {
    id: '1',
    type: AssetType.IMAGE,
    url: 'https://images.unsplash.com/photo-1542206395-9feb3edaa68d?q=80&w=1920&auto=format&fit=crop',
    name: 'Nature Landscape',
    duration: 10,
    scale: AssetScale.FIT
  },
  {
    id: '2',
    type: AssetType.WEBSITE,
    url: 'https://www.google.com/search?igu=1',
    name: 'Google Search',
    duration: 15,
  }
];