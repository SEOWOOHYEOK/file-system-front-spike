/**
 * 동기화 대시보드 타입 정의
 * API: /v1/admin/sync/dashboard/*
 */

// ─── Enum 타입 ───

/** 동기화 이벤트 상태 */
export type SyncEventStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'RETRYING'
  | 'DONE'
  | 'FAILED';

/** 동기화 이벤트 타입 */
export type SyncEventType =
  | 'CREATE'
  | 'MOVE'
  | 'DELETE'
  | 'RENAME'
  | 'TRASH'
  | 'RESTORE'
  | 'PURGE';

/** 동기화 대상 타입 */
export type SyncEventTargetType = 'FILE' | 'FOLDER';

/** 정렬 순서 */
export type SortOrder = 'asc' | 'desc';

// ─── 요청 타입 ───

/** GET /v1/admin/sync/dashboard/events 쿼리 파라미터 */
export interface SyncDashboardEventsQuery {
  /** 동기화 상태 필터 */
  status?: SyncEventStatus;
  /** 이벤트 타입 필터 */
  eventType?: SyncEventType;
  /** 대상 타입 필터 (FILE/FOLDER) */
  targetType?: SyncEventTargetType;
  /** 사용자 ID 필터 (UUID) */
  userId?: string;
  /** 시작 날짜 (YYYY-MM-DD) */
  fromDate?: string;
  /** 종료 날짜 (YYYY-MM-DD) */
  toDate?: string;
  /** 페이지 번호 (기본: 1) */
  page?: number;
  /** 페이지 크기 (기본: 20, 최대: 100) */
  pageSize?: number;
  /** 정렬 기준 (createdAt, updatedAt, status, eventType) */
  sortBy?: string;
  /** 정렬 순서 (기본: desc) */
  sortOrder?: SortOrder;
}

// ─── 응답 타입 ───

/** GET /v1/admin/sync/dashboard/summary 응답 */
export interface SyncDashboardSummaryResponse {
  /** 전체 이벤트 수 */
  total: number;
  /** PENDING 수 */
  pending: number;
  /** QUEUED 수 */
  queued: number;
  /** PROCESSING 수 */
  processing: number;
  /** RETRYING 수 */
  retrying: number;
  /** DONE 수 */
  done: number;
  /** FAILED 수 */
  failed: number;
  /** stuck 상태 수 (PENDING 1시간+ 또는 PROCESSING 30분+) */
  stuckCount: number;
  /** 조회 시각 (ISO 8601) */
  checkedAt: string;
}

/** 요청자 정보 */
export interface RequesterInfo {
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 부서 (없으면 null) */
  department: string | null;
}

/** 동기화 이벤트 아이템 */
export interface SyncDashboardEventItem {
  /** 이벤트 ID (UUID) */
  id: string;
  /** 동기화 상태 */
  status: SyncEventStatus;
  /** 이벤트 타입 */
  eventType: SyncEventType;
  /** 대상 타입 */
  targetType: SyncEventTargetType;
  /** 파일 ID (FILE일 때, UUID) */
  fileId: string | null;
  /** 폴더 ID (FOLDER일 때, UUID) */
  folderId: string | null;
  /** 파일/폴더 이름 */
  fileName: string;
  /** 대상 경로 */
  filePath: string;
  /** 파일 크기 bytes (FILE일 때만, FOLDER는 null) */
  fileSize: number | null;
  /** 포맷된 크기 (FILE일 때만, 예: "1.50 MB") */
  fileSizeFormatted: string | null;
  /** 처리 완료 시각 (ISO 8601, 미완료시 null) */
  completedAt: string | null;
  /** 소요 시간 초 (미완료시 null) */
  duration: number | null;
  /** 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 요청자 정보 */
  requester: RequesterInfo;
  /** 에러 메시지 (없으면 null) */
  errorMessage: string | null;
  /** stuck 상태 여부 */
  isStuck: boolean;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 수정 시각 (ISO 8601) */
  updatedAt: string;
}

// ─── 페이지네이션 ───

export interface SyncPaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** GET /v1/admin/sync/dashboard/events 응답 */
export type SyncDashboardEventsResponse = SyncPaginatedResponse<SyncDashboardEventItem>;
