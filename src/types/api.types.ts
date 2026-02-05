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
// 711.외부접근 다운로드 (External Share Download with Range)
// ============================================================

/**
 * Range 다운로드 옵션 (외부 공유용)
 */
export interface ExtRangeDownloadOptions {
  /** 시작 바이트 */
  start?: number;
  /** 끝 바이트 */
  end?: number;
  /** ETag for safe resume (If-Range 헤더) */
  ifRange?: string;
}

/**
 * Content-Range 정보
 */
export interface ExtContentRange {
  start: number;
  end: number;
  total: number;
}

/**
 * 외부 공유 다운로드 응답 (메타데이터 포함)
 */
export interface ExtDownloadResponse {
  blob: Blob;
  filename: string;
  /** ETag 헤더 값 */
  etag?: string;
  /** X-Checksum-SHA256 헤더 값 */
  checksum?: string;
  /** 전체 파일 크기 */
  totalSize: number;
  /** 206 Partial Content 여부 */
  isPartial: boolean;
  /** Content-Range 정보 (부분 응답시) */
  contentRange?: ExtContentRange;
}

/**
 * 외부 공유 다운로드 진행 상태 (이어받기용)
 */
export interface ExtDownloadProgress {
  shareId: string;
  etag: string;
  totalSize: number;
  downloadedSize: number;
  chunks: Blob[];
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
