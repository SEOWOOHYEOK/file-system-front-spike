/**
 * 역할별 권한 매핑 관리 타입 정의
 * 809.관리자 - 역할별 권한 매핑 관리
 */

// ── 공통 응답 타입 ──────────────────────────────

/** 권한 정보 */
export interface RolePermission {
  /** 권한 코드 (예: 'FILE_READ') */
  code: string;
  /** 권한 설명 (예: '파일 조회/검색') */
  description: string;
}

/** 역할별 권한 매핑 정보 */
export interface RolePermissionResponse {
  /** 역할 ID (UUID) */
  roleId: string;
  /** 역할 이름 (예: 'ADMIN', 'MANAGER', 'USER', 'GUEST') */
  roleName: string;
  /** 역할 설명 (예: '관리자') */
  roleDescription: string;
  /** 해당 역할에 부여된 권한 목록 */
  permissions: RolePermission[];
}

/** 카테고리별 권한 그룹 */
export interface PermissionCategory {
  /** 카테고리 이름 (예: 'File Management') */
  category: string;
  /** 해당 카테고리의 권한 목록 */
  permissions: RolePermission[];
}

// ── 요청 타입 ───────────────────────────────────

/** 역할에 권한 추가 요청 */
export interface AddPermissionRequest {
  /** 추가할 권한 코드 (PermissionEnum 값) */
  permissionCode: string;
}

// ── PermissionEnum ──────────────────────────────

export enum PermissionEnum {
  // User Management
  USER_READ = 'USER_READ',
  USER_WRITE = 'USER_WRITE',

  // Role Management
  ROLE_READ = 'ROLE_READ',
  ROLE_WRITE = 'ROLE_WRITE',

  // Audit & Monitoring
  AUDIT_READ = 'AUDIT_READ',
  AUDIT_EXPORT = 'AUDIT_EXPORT',
  SYSTEM_MONITOR = 'SYSTEM_MONITOR',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  SYNC_MANAGE = 'SYNC_MANAGE',

  // File Management
  FILE_READ = 'FILE_READ',
  FILE_WRITE = 'FILE_WRITE',
  FILE_DELETE = 'FILE_DELETE',
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DOWNLOAD = 'FILE_DOWNLOAD',
  FILE_MOVE = 'FILE_MOVE',

  // File Request/Approval Workflow
  FILE_MOVE_REQUEST = 'FILE_MOVE_REQUEST',
  FILE_MOVE_APPROVE = 'FILE_MOVE_APPROVE',
  FILE_DELETE_REQUEST = 'FILE_DELETE_REQUEST',
  FILE_DELETE_APPROVE = 'FILE_DELETE_APPROVE',

  // Trash & Recovery
  TRASH_READ = 'TRASH_READ',
  FILE_PURGE = 'FILE_PURGE',
  FILE_RESTORE = 'FILE_RESTORE',

  // Share Management
  FILE_SHARE_CREATE = 'FILE_SHARE_CREATE',
  FILE_SHARE_READ = 'FILE_SHARE_READ',
  FILE_SHARE_DELETE = 'FILE_SHARE_DELETE',
  FILE_SHARE_DIRECT = 'FILE_SHARE_DIRECT',
  FILE_SHARE_REQUEST = 'FILE_SHARE_REQUEST',
  FILE_SHARE_APPROVE = 'FILE_SHARE_APPROVE',
  SHARE_LOG_READ = 'SHARE_LOG_READ',

  // External Share Access
  EXTERNAL_SHARE_READ = 'EXTERNAL_SHARE_READ',
  EXTERNAL_SHARE_VIEW = 'EXTERNAL_SHARE_VIEW',
  EXTERNAL_SHARE_DOWNLOAD = 'EXTERNAL_SHARE_DOWNLOAD',

  // Folder Management
  FOLDER_READ = 'FOLDER_READ',
  FOLDER_WRITE = 'FOLDER_WRITE',
  FOLDER_DELETE = 'FOLDER_DELETE',
}

// ── 에러 응답 타입 ──────────────────────────────

export interface RolePermissionErrorResponse {
  /** HTTP 상태 코드 */
  statusCode: number;
  /** 숫자 에러 코드 */
  errorCode: number;
  /** 내부 식별자 */
  internalCode: string;
  /** 에러 메시지 (한국어) */
  message: string;
}

// ── API 로그 타입 ───────────────────────────────

export interface RolePermissionApiLogEntry {
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
