/**
 * Admin API 타입 정의
 * 500.관리자, 510.관리자-공유, 520.관리자-외부사용자, 600.외부공유
 *
 * 참고: 100.인증 타입은 auth.types.ts로 분리되었습니다.
 * 하위 호환: InternalUser, SSOToken, InternalAuthState는 useInternalAuth.ts에서 re-export됩니다.
 */

// ============================================
// 500.관리자 (Admin System)
// ============================================

export interface CacheHealthResponse {
  status: 'healthy' | 'unhealthy';
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

export interface NasHealthResponse {
  status: 'healthy' | 'unhealthy';
  connected: boolean;
  totalSpace?: number;
  usedSpace?: number;
  freeSpace?: number;
  usagePercent?: number;
  error?: string;
}

export interface StorageConsistencyQuery {
  storageType?: 'cache' | 'nas';
  limit?: number;
  offset?: number;
  sample?: boolean;
}

export interface StorageConsistencyResponse {
  consistent: boolean;
  totalFiles: number;
  missingInNas: number;
  missingInDb: number;
  orphanedFiles: string[];
  missingFiles: string[];
}

export interface SyncEvent {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileId?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface SyncEventsResponse {
  items: SyncEvent[];
  total: number;
}

// ============================================
// 510.관리자-공유 (Admin Share Management)
// ============================================

export interface AdminShare {
  id: string;
  fileId: string;
  fileName: string;
  creatorId: string;
  creatorName: string;
  externalUserId: string;
  externalUserName: string;
  permissions: string[];
  isBlocked: boolean;
  viewCount: number;
  downloadCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminSharesResponse {
  items: AdminShare[];
  total: number;
}

export interface AdminShareDetailResponse extends AdminShare {
  file: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
  };
  accessLogs: {
    id: string;
    action: string;
    ipAddress: string;
    createdAt: string;
  }[];
}

export interface SharedFile {
  fileId: string;
  fileName: string;
  shareCount: number;
  activeShareCount: number;
  blockedShareCount: number;
}

export interface SharedFilesResponse {
  items: SharedFile[];
  total: number;
}

export interface FileSharesResponse {
  items: AdminShare[];
  total: number;
}

// ============================================
// 520.관리자-외부사용자 (Admin External User)
// ============================================

export interface ExternalUser {
  id: string;
  username: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  isActive: boolean;
  isInitialPassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalUsersResponse {
  items: ExternalUser[];
  total: number;
}

export interface CreateExternalUserDto {
  username: string;
  password: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
}

export interface UpdateExternalUserDto {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  temporaryPassword: string;
}

// ============================================
// 600.외부공유 (File Share)
// ============================================

export interface CreateFileShareDto {
  fileId: string;
  externalUserId: string;
  permissions: ('VIEW' | 'DOWNLOAD')[];
  expiresAt?: string;
  maxViewCount?: number;
  maxDownloadCount?: number;
}

export interface FileShare {
  id: string;
  fileId: string;
  fileName: string;
  externalUserId: string;
  externalUserName: string;
  permissions: string[];
  viewCount: number;
  downloadCount: number;
  maxViewCount?: number;
  maxDownloadCount?: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface FileSharesListResponse {
  items: FileShare[];
  total: number;
}

export interface AvailableExternalUser {
  id: string;
  username: string;
  name: string;
  email: string;
  company?: string;
}

export interface AvailableExternalUsersResponse {
  items: AvailableExternalUser[];
  total: number;
}

// ============================================
// API Log Entry (공통)
// ============================================

export interface AdminApiLogEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  request?: unknown;
  response?: unknown;
  error?: string;
  timestamp: Date;
}
