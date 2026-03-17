/**
 * 관리자 - 감사 로그 및 통합 타임라인 API 타입 정의
 * Swagger 태그: 806.관리자 - audit log 확인
 */

// ─── Enum 타입 ───

/** 감사 행위 타입 */
export type AuditAction =
  // 파일 관련
  | "FILE_VIEW"
  | "FILE_DOWNLOAD"
  | "FILE_UPLOAD"
  | "FILE_RENAME"
  | "FILE_MOVE"
  | "FILE_DELETE"
  | "FILE_RESTORE"
  | "FILE_PURGE"
  // 폴더 관련
  | "FOLDER_CREATE"
  | "FOLDER_VIEW"
  | "FOLDER_RENAME"
  | "FOLDER_MOVE"
  | "FOLDER_DELETE"
  // 공유 관련
  | "SHARE_CREATE"
  | "SHARE_REVOKE"
  | "SHARE_ACCESS"
  | "SHARE_DOWNLOAD"
  | "SHARE_BLOCK"
  | "SHARE_UNBLOCK"
  | "SHARE_BULK_BLOCK"
  | "SHARE_BULK_UNBLOCK"
  // 공유 요청 관련
  | "SHARE_REQUEST_CREATE"
  | "SHARE_REQUEST_APPROVE"
  | "SHARE_REQUEST_REJECT"
  | "SHARE_REQUEST_CANCEL"
  | "SHARE_REQUEST_BULK_APPROVE"
  | "SHARE_REQUEST_BULK_REJECT"
  // 권한 관련
  | "PERMISSION_GRANT"
  | "PERMISSION_REVOKE"
  | "PERMISSION_CHANGE"
  // 휴지통 관련
  | "TRASH_EMPTY"
  | "TRASH_VIEW"
  // 즐겨찾기 관련
  | "FAVORITE_ADD"
  | "FAVORITE_REMOVE"
  | "FAVORITE_VIEW"
  // 사용자 활동
  | "ACTIVITY_VIEW"
  // 외부 사용자 관리
  | "EXTERNAL_USER_CREATE"
  | "EXTERNAL_USER_UPDATE"
  | "EXTERNAL_USER_DEACTIVATE"
  | "EXTERNAL_USER_ACTIVATE"
  | "EXTERNAL_USER_PASSWORD_RESET"
  // 비밀번호
  | "PASSWORD_CHANGE"
  // 관리자 작업
  | "USER_ROLE_ASSIGN"
  | "USER_ROLE_REMOVE"
  | "USER_SYNC"
  | "TOKEN_GENERATE"
  | "TOKEN_REFRESH"
  | "ORG_MIGRATION"
  // 파일 작업 요청
  | "FILE_ACTION_REQUEST_MOVE_CREATE"
  | "FILE_ACTION_REQUEST_DELETE_CREATE"
  | "FILE_ACTION_REQUEST_CANCEL"
  | "FILE_ACTION_REQUEST_APPROVE"
  | "FILE_ACTION_REQUEST_REJECT"
  | "FILE_ACTION_REQUEST_BULK_APPROVE"
  | "FILE_ACTION_REQUEST_BULK_REJECT"
  | "FILE_ACTION_REQUEST_INVALIDATED"
  // 외부 사용자 공유 접근
  | "EXTERNAL_SHARE_DETAIL"
  | "EXTERNAL_SHARE_ACCESS"
  | "EXTERNAL_SHARE_DOWNLOAD"
  // 보안 이벤트
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "TOKEN_EXPIRED"
  | "PERMISSION_DENIED"
  | "EXPIRED_LINK_ACCESS"
  | "BLOCKED_SHARE_ACCESS"
  | "ACCESS_PATTERN_DEVIATION"
  | "NEW_DEVICE_ACCESS";

/** 사용자 유형 */
export type UserType = "INTERNAL" | "EXTERNAL";

/** 대상 타입 */
export type TargetType =
  | "FILE"
  | "FOLDER"
  | "SHARE"
  | "USER"
  | "FAVORITE"
  | "ACTIVITY"
  | "SYSTEM"
  | "FILE_ACTION_REQUEST";

/** 로그 결과 */
export type LogResult = "SUCCESS" | "FAIL";

/** 파일 변경 유형 */
export type FileChangeType =
  | "CREATED"
  | "CONTENT_REPLACED"
  | "RENAMED"
  | "MOVED"
  | "METADATA_CHANGED"
  | "TRASHED"
  | "RESTORED"
  | "DELETED";

/** 이벤트 소스 */
export type EventSource = "AUDIT" | "FILE_CHANGE" | "SYSTEM";

/** 행위 카테고리 */
export type ActionCategory =
  | "file"
  | "folder"
  | "share"
  | "auth"
  | "admin"
  | "user"
  | "security"
  | "external";

/** 클라이언트 타입 */
export type ClientType = "WEB" | "MOBILE" | "API" | "UNKNOWN";

/** 기밀 등급 */
export type Sensitivity = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";

// ─── 응답 타입 ───

/** 감사 로그 메타데이터 */
export interface AuditLogMetadata {
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
  shareType?: string;
  expiresAt?: string;
  permissions?: string[];
  maxAccessCount?: number;
  previousPermissions?: string[];
  newPermissions?: string[];
  changeReason?: string;
  [key: string]: unknown;
}

/** 감사 로그 항목 */
export interface AuditLog {
  id: string;
  requestId: string;
  sessionId?: string;
  traceId?: string;
  userId: string;
  userType: UserType;
  userName?: string;
  userEmail?: string;
  action: AuditAction;
  actionCategory: ActionCategory;
  targetType: TargetType;
  targetId: string;
  targetName?: string;
  targetPath?: string;
  sensitivity?: Sensitivity;
  ownerId?: string;
  ipAddress: string;
  userAgent: string;
  clientType: ClientType;
  result: LogResult;
  resultCode?: string;
  failReason?: string;
  durationMs?: number;
  metadata?: AuditLogMetadata;
  tags?: string[];
  httpMethod?: string;
  apiEndpoint?: string;
  parentEventId?: string;
  severity?: string;
  errorCode?: string;
  responseStatusCode?: number;
  systemAction?: string;
  systemActionDetail?: string;
  followUpScheduled?: boolean;
  followUpAt?: string;
  retryCount?: number;
  description: string;
  syncEventId?: string;
  createdAt: string;
}

/** 파일 상태 */
export interface FileState {
  name?: string;
  size?: number;
  mimeType?: string;
  folderId?: string;
  path?: string;
  [key: string]: unknown;
}

/** 파일 이력 항목 */
export interface FileHistory {
  id: string;
  fileId: string;
  version: number;
  changeType: FileChangeType;
  changedBy: string;
  userType: UserType;
  previousState?: FileState;
  newState?: FileState;
  checksumBefore?: string;
  checksumAfter?: string;
  changeSummary?: string;
  description: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;
  httpMethod?: string;
  apiEndpoint?: string;
  errorCode?: string;
  retryCount?: number;
  tags?: string[];
  createdAt: string;
}

/** 페이지네이션 결과 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 관찰 가능성 이벤트 (통합 타임라인 이벤트) */
export interface ObservabilityEvent {
  id: string;
  eventSource: EventSource;
  eventType: string;
  occurredAt: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;
  actorId: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  result: "SUCCESS" | "FAILURE";
  errorCode?: string;
  severity?: string;
  durationMs?: number;
  httpMethod?: string;
  apiEndpoint?: string;
  responseStatusCode?: number;
  systemAction?: string;
  systemActionDetail?: string;
  followUpScheduled?: boolean;
  followUpAt?: string;
  retryCount?: number;
  tags?: string[];
  description: string;
}

/** 통합 타임라인 응답 */
export interface UnifiedTimelineResponse {
  events: ObservabilityEvent[];
  summary: {
    total: number;
    bySource: Record<EventSource, number>;
    byResult: {
      SUCCESS: number;
      FAILURE: number;
    };
    bySeverity?: Record<string, number>;
    timeRange: {
      earliest: string | null;
      latest: string | null;
    };
  };
  page: {
    current: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

// ─── Query Parameters 타입 ───

/** 감사 로그 목록 조회 파라미터 */
export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  userId?: string;
  userType?: UserType;
  action?: AuditAction;
  targetType?: TargetType;
  targetId?: string;
  result?: LogResult;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
}

/** 파일 이력 목록 조회 파라미터 */
export interface FileHistoryQueryParams {
  page?: number;
  limit?: number;
  fileId?: string;
  changeType?: FileChangeType;
  changedBy?: string;
  startDate?: string;
  endDate?: string;
}

/** 통합 타임라인 조회 파라미터 */
export interface TimelineQueryParams {
  from: string;
  to: string;
  eventSources?: EventSource[];
  severity?: string;
  result?: "SUCCESS" | "FAILURE";
  errorCode?: string;
  page?: number;
  size?: number;
}

/** 파일/사용자 중심 타임라인 파라미터 */
export interface EntityTimelineParams {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

// ─── 감사 로그 요약 ───

/** 카테고리별 교차 집계 항목 (백엔드 CategorySummaryItem 매칭) */
export interface CategorySummaryItem {
  /** 카테고리 코드 */
  category: ActionCategory;
  /** 카테고리 한국어 라벨 */
  label: string;
  /** 해당 카테고리 전체 로그 수 */
  totalCount: number;
  /** 성공 수 */
  successCount: number;
  /** 실패 수 */
  failCount: number;
}

/** 감사 로그 요약 응답 (백엔드 AuditLogSummary 매칭) */
export interface AuditLogSummary {
  /** 전체 로그 수 */
  totalCount: number;
  /** 전체 성공 수 */
  totalSuccess: number;
  /** 전체 실패 수 */
  totalFail: number;
  /** 카테고리별 성공/실패 카운트 */
  byCategory: CategorySummaryItem[];
}

/** 감사 로그 요약 조회 파라미터 */
export interface AuditLogSummaryParams {
  userId?: string;
  userType?: "INTERNAL" | "EXTERNAL";
  action?: string;
  targetType?: string;
  targetId?: string;
  result?: "SUCCESS" | "FAIL";
  ipAddress?: string;
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
}

// ─── UI 헬퍼 타입 ───

/** 이벤트 타입 카테고리 (필터 사이드바용) */
export type EventTypeCategory =
  | "all"
  | "user_activity"
  | "permission"
  | "file_operation"
  | "share_request"
  | "security";

/** 결과 상태 필터 */
export type ResultFilter = "all" | "SUCCESS" | "FAIL";

/** 시간 버켓 */
export interface TimeBucket {
  bucketStart: string;
  bucketEnd: string;
  count: number;
}

/** 시간 버켓 결과 */
export interface TimeBucketResult {
  bucketSeconds: number;
  buckets: TimeBucket[];
}
