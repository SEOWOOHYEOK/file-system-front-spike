/**
 * External Share API Types
 * 700.외부인증 & 710.외부접근 API 타입 정의
 */

// ============================================================
// 700.외부인증 (External Auth)
// ============================================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    company?: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ============================================================
// 710.외부접근 (External Share Access)
// ============================================================

export type SharePermission = 'VIEW' | 'DOWNLOAD';

export interface PublicShare {
  id: string;
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  ownerId: string;
  externalUserId: string;
  permissions: SharePermission[];
  maxViewCount?: number;
  currentViewCount: number;
  maxDownloadCount?: number;
  currentDownloadCount: number;
  expiresAt?: string;
  isBlocked: boolean;
  isRevoked: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ShareDetailResponse {
  share: PublicShare;
  contentToken: string;
  tokenExpiresAt?: string;
}

// ============================================================
// API Log Types (테스트 러너용)
// ============================================================

export interface ApiLogEntry {
  id: string;
  timestamp: Date;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  status: number;
  duration: number;
  request?: unknown;
  response?: unknown;
  error?: string;
}

export type ScenarioStatus = 'pending' | 'running' | 'success' | 'error';

export interface ScenarioStep {
  id: string;
  name: string;
  description: string;
  status: ScenarioStatus;
  result?: unknown;
  error?: string;
}
