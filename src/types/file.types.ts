/**
 * 파일/폴더/휴지통 API 타입 정의
 * 200.파일, 210.폴더, 220.휴지통
 */

// ============================================
// 공통 타입
// ============================================

/**
 * 파일 상태
 */
export type FileState = 'ACTIVE' | 'TRASHED' | 'DELETED';

/**
 * 폴더 상태
 */
export type FolderState = 'ACTIVE' | 'TRASHED';

/**
 * 파일 스토리지 가용성 상태
 */
export type AvailabilityStatus = 'AVAILABLE' | 'SYNCING' | 'UNAVAILABLE' | 'ERROR';

/**
 * 폴더 스토리지 가용성 상태
 */
export type FolderAvailabilityStatus = 'AVAILABLE' | 'SYNCING' | 'UNAVAILABLE' | 'ERROR';

/**
 * 파일 충돌 전략
 */
export type ConflictStrategy = 'ERROR' | 'RENAME';

/**
 * 파일 이동 충돌 전략
 */
export type MoveConflictStrategy = 'ERROR' | 'OVERWRITE' | 'RENAME' | 'SKIP';

/**
 * 폴더 충돌 전략
 */
export type FolderConflictStrategy = 'ERROR' | 'RENAME';

/**
 * 폴더 이동 충돌 전략
 */
export type MoveFolderConflictStrategy = 'ERROR' | 'RENAME' | 'SKIP';

// ============================================
// 200.파일 (File)
// ============================================

/**
 * 스토리지 상태
 */
export interface StorageStatus {
  cache: AvailabilityStatus | null;
  nas: AvailabilityStatus | null;
}

/**
 * 파일 정보 응답
 */
export interface FileInfoResponse {
  id: string;
  name: string;
  folderId: string;
  path: string;
  size: number;
  mimeType: string;
  state: FileState;
  storageStatus: StorageStatus;
  /** SHA-256 체크섬 (서버에서 제공 시) */
  checksum?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 파일 목록 아이템
 */
export interface FileListItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  storageStatus: StorageStatus;
  updatedAt: string;
}

/**
 * 파일 업로드 응답
 */
export interface UploadFileResponse {
  id: string;
  name: string;
  folderId: string;
  path: string;
  size: number;
  mimeType: string;
  storageStatus: {
    cache: 'AVAILABLE';
    nas: 'SYNCING';
  };
  createdAt: string;
  syncEventId: string;
}

/**
 * 파일명 변경 요청
 */
export interface RenameFileRequest {
  newName: string;
  conflictStrategy?: ConflictStrategy;
}

/**
 * 파일명 변경 응답
 */
export interface RenameFileResponse {
  id: string;
  name: string;
  path: string;
  storageStatus: {
    nas: 'SYNCING';
  };
  updatedAt: string;
  syncEventId: string;
}

/**
 * 파일 이동 요청
 */
export interface MoveFileRequest {
  targetFolderId: string;
  conflictStrategy?: MoveConflictStrategy;
}

/**
 * 파일 이동 응답
 */
export interface MoveFileResponse {
  id: string;
  name: string;
  folderId: string;
  path: string;
  skipped?: boolean;
  reason?: string;
  storageStatus: {
    nas: 'SYNCING';
  };
  updatedAt: string;
  syncEventId?: string;
}

/**
 * 파일 삭제(휴지통 이동) 응답
 */
export interface DeleteFileResponse {
  id: string;
  name: string;
  state: FileState;
  trashedAt: string;
  syncEventId: string;
}

// ============================================
// 210.폴더 (Folder)
// ============================================

/**
 * 폴더 스토리지 상태
 */
export interface FolderStorageStatus {
  nas: FolderAvailabilityStatus | null;
}

/**
 * 폴더 정보 응답
 */
export interface FolderInfoResponse {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  state: FolderState;
  storageStatus: FolderStorageStatus;
  fileCount: number;
  folderCount: number;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 브레드크럼 아이템
 */
export interface BreadcrumbItem {
  id: string;
  name: string;
}

/**
 * 폴더 목록 아이템
 */
export interface FolderListItem {
  id: string;
  name: string;
  path: string;
  storageStatus: FolderStorageStatus;
  fileCount: number;
  folderCount: number;
  updatedAt: string;
}

/**
 * 파일 목록 아이템 (폴더 내용 조회용)
 */
export interface FileListItemInFolder {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  storageStatus: {
    cache: string | null;
    nas: string | null;
  };
  /** 파일 생성자 (업로더) ID */
  createdBy?: string;
  updatedAt: string;
}

/**
 * 페이지네이션 정보
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 폴더 내용 응답
 */
export interface FolderContentsResponse {
  folderId: string;
  path: string;
  breadcrumbs: BreadcrumbItem[];
  folders: FolderListItem[];
  files: FileListItemInFolder[];
  pagination: PaginationInfo;
}

/**
 * 폴더 내용 조회 쿼리 파라미터
 */
export interface GetFolderContentsQuery {
  sortBy?: 'name' | 'type' | 'createdAt' | 'updatedAt' | 'size';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * 폴더 생성 요청
 */
export interface CreateFolderRequest {
  name: string;
  parentId: string | null;
  conflictStrategy?: FolderConflictStrategy;
}

/**
 * 폴더 생성 응답
 */
export interface CreateFolderResponse {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  storageStatus: {
    nas: 'SYNCING';
  };
  createdAt: string;
}

/**
 * 폴더명 변경 요청
 */
export interface RenameFolderRequest {
  newName: string;
  conflictStrategy?: FolderConflictStrategy;
}

/**
 * 폴더명 변경 응답
 */
export interface RenameFolderResponse {
  id: string;
  name: string;
  path: string;
  storageStatus: {
    nas: 'SYNCING';
  };
  updatedAt: string;
}

/**
 * 폴더 이동 요청
 */
export interface MoveFolderRequest {
  targetParentId: string;
  conflictStrategy?: MoveFolderConflictStrategy;
}

/**
 * 폴더 이동 응답
 */
export interface MoveFolderResponse {
  id: string;
  name: string;
  parentId: string;
  path: string;
  skipped?: boolean;
  reason?: string;
  storageStatus: {
    nas: 'SYNCING';
  };
  updatedAt: string;
}

/**
 * 폴더 삭제(휴지통 이동) 응답
 */
export interface DeleteFolderResponse {
  id: string;
  name: string;
  state: FolderState;
  trashedAt: string;
}

// ============================================
// 220.휴지통 (Trash)
// ============================================

/**
 * 휴지통 정렬 기준
 */
export type TrashSortBy = 'name' | 'sizeBytes' | 'mimeType' | 'deletedAt' | 'expiresAt' | 'deletedBy';

/**
 * 휴지통 정렬 순서
 */
export type TrashSortOrder = 'asc' | 'desc';

/**
 * MIME 카테고리
 */
export type MimeCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/**
 * 복원 경로 상태
 */
export type RestorePathStatus = 'AVAILABLE' | 'NOT_FOUND';

/**
 * 휴지통 목록 조회 쿼리 파라미터
 */
export interface TrashListQuery {
  page?: number;
  limit?: number;
  sortBy?: TrashSortBy;
  order?: TrashSortOrder;
  search?: string;
  mimeType?: string;
  mimeCategory?: MimeCategory;
  deletedBy?: string;
  deletedAfter?: string;
  deletedBefore?: string;
  expiresAfter?: string;
  expiresBefore?: string;
  minSize?: number;
  maxSize?: number;
  originalFolderId?: string;
}

/**
 * 휴지통 아이템
 */
export interface TrashItem {
  type: 'FILE';
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
  trashMetadataId: string;
  originalPath: string;
  originalFolderId: string;
  originalFolderName: string;
  deletedAt: string;
  deletedBy: string;
  deletedByName: string;
  expiresAt: string;
  daysUntilExpiry: number;
  createdAt: string;
  restoreInfo: {
    pathStatus: RestorePathStatus;
    resolveFolderId: string | null;
  };
}

/**
 * 휴지통 목록 응답
 */
export interface TrashListResponse {
  items: TrashItem[];
  totalCount: number;
  totalSizeBytes: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  appliedFilters: {
    search?: string;
    mimeType?: string;
    mimeCategory?: string;
    deletedBy?: string;
    dateRange?: { from?: string; to?: string };
    sizeRange?: { min?: number; max?: number };
  };
}

/**
 * 복원 미리보기 요청
 */
export interface RestorePreviewRequest {
  trashMetadataIds?: string[];
}

/**
 * 복원 미리보기 응답 항목
 */
export interface RestorePreviewItem {
  trashMetadataId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  deletedAt: string;
  pathStatus: RestorePathStatus;
  originalPath: string;
  originalFolderId: string;
  resolveFolderId: string | null;
  hasConflict: boolean;
  conflictFileId?: string;
}

/**
 * 복원 미리보기 응답
 */
export interface RestorePreviewResponse {
  totalCount: number;
  items: RestorePreviewItem[];
  summary: {
    available: number;
    notFound: number;
    conflict: number;
  };
}

/**
 * 복원 실행 요청 항목
 */
export interface RestoreExecuteItem {
  trashMetadataId: string;
  targetFolderId?: string;
  exclude?: boolean;
}

/**
 * 복원 실행 요청
 */
export interface RestoreExecuteRequest {
  items: RestoreExecuteItem[];
}

/**
 * 복원 실행 응답
 */
export interface RestoreExecuteResponse {
  message: string;
  queued: number;
  excluded: number;
  skipped: number;
  syncEventIds: string[];
  skippedItems: {
    trashMetadataId: string;
    fileName: string;
    reason: 'CONFLICT' | 'PATH_NOT_FOUND';
    conflictFileId?: string;
  }[];
}

/**
 * 복원 상태 조회 응답
 */
export interface RestoreStatusResponse {
  summary: {
    total: number;
    pending: number;
    processing: number;
    done: number;
    failed: number;
  };
  isCompleted: boolean;
  items: {
    syncEventId: string;
    fileId: string;
    fileName: string;
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
    errorMessage?: string;
    createdAt: string;
    processedAt?: string;
  }[];
}

/**
 * 영구삭제 응답
 */
export interface PurgeResponse {
  id: string;
  name: string;
  type: 'FILE';
  purgedAt: string;
}

/**
 * 휴지통 비우기 응답
 */
export interface EmptyTrashResponse {
  message: string;
  success: number;
  failed: number;
}

// ============================================
// 201.멀티파트 업로드 (Multipart Upload)
// ============================================

/**
 * 업로드 세션 상태
 */
export type UploadSessionStatus = 'INIT' | 'UPLOADING' | 'COMPLETED' | 'ABORTED' | 'EXPIRED';

/**
 * 멀티파트 업로드 초기화 요청
 */
export interface InitiateMultipartRequest {
  fileName: string;
  folderId: string;
  totalSize: number;
  mimeType: string;
  conflictStrategy?: ConflictStrategy;
}

/**
 * 멀티파트 업로드 초기화 응답 (유니온 타입)
 * - 201: 슬롯 확보 → ACTIVE (즉시 업로드 시작)
 * - 202: 슬롯 부족 → WAITING (대기열 폴링 필요)
 */
export type InitiateMultipartResponse = InitiateActiveResponse | InitiateQueuedResponse;

export interface InitiateActiveResponse {
  status: 'ACTIVE';
  sessionId: string;
  partSize: number;
  totalParts: number;
  expiresAt: string;
}

export interface InitiateQueuedResponse {
  status: 'WAITING';
  queueTicket: string;
  position: number;
  estimatedWaitSeconds: number;
}

/**
 * 대기열 폴링 응답 (유니온 타입)
 */
export type QueueStatusResponse =
  | QueueWaitingResponse
  | QueueReadyResponse
  | QueueExpiredResponse
  | QueueCancelledResponse;

export interface QueueWaitingResponse {
  status: 'WAITING';
  position: number;
  estimatedWaitSeconds: number;
}

export interface QueueReadyResponse {
  status: 'READY';
  sessionId: string;
  partSize: number;
  totalParts: number;
  expiresAt: string;
  claimDeadline: string;
}

export interface QueueExpiredResponse {
  status: 'EXPIRED';
  message: string;
}

export interface QueueCancelledResponse {
  status: 'CANCELLED';
  message: string;
}

/**
 * 대기열 취소 응답
 */
export interface QueueCancelResponse {
  success: boolean;
  message: string;
}

/**
 * 대기열 전체 현황 응답
 */
export interface QueueOverallStatus {
  activeSessions: number;
  maxActiveSessions: number;
  waitingCount: number;
  maxQueueSize: number;
  totalUploadBytes: number;
  maxTotalUploadBytes: number;
  availableSlots: number;
}

/**
 * 파트 업로드 응답
 */
export interface UploadPartResponse {
  partNumber: number;
  etag: string;
  size: number;
  sessionProgress: number;
}

/**
 * 멀티파트 업로드 완료 요청
 */
export interface CompleteMultipartRequest {
  parts?: { partNumber: number; etag: string }[];
}

/**
 * 멀티파트 업로드 완료 응답
 */
export interface CompleteMultipartResponse {
  fileId: string;
  name: string;
  folderId: string;
  path: string;
  size: number;
  mimeType: string;
  storageStatus: {
    cache: 'AVAILABLE';
    nas: 'SYNCING';
  };
  createdAt: string;
  syncEventId: string;
}

/**
 * 세션 상태 조회 응답
 */
export interface SessionStatusResponse {
  sessionId: string;
  fileName: string;
  status: UploadSessionStatus;
  totalSize: number;
  uploadedBytes: number;
  progress: number;
  totalParts: number;
  completedParts: number[];
  nextPartNumber: number | null;
  remainingBytes: number;
  expiresAt: string;
  fileId?: string;
}

/**
 * 업로드 취소 응답
 */
export interface AbortSessionResponse {
  sessionId: string;
  status: 'ABORTED';
  message: string;
}

// ============================================
// 210.검색 (Search)
// ============================================

/**
 * 검색 결과 아이템 타입
 */
export type SearchResultType = 'file' | 'folder';

/**
 * 검색 정렬 기준
 */
export type SearchSortBy = 'name' | 'type' | 'createdAt' | 'updatedAt' | 'size';

/**
 * 검색 정렬 순서
 */
export type SearchSortOrder = 'asc' | 'desc';

/**
 * 검색 쿼리 파라미터
 */
export interface SearchQuery {
  /** 검색 키워드 (최소 2자) */
  keyword: string;
  /** 검색 대상 타입 (미지정 시 전체 검색) */
  type?: SearchResultType;
  /** 정렬 기준 */
  sortBy?: SearchSortBy;
  /** 정렬 순서 */
  sortOrder?: SearchSortOrder;
  /** 페이지 번호 (1부터 시작) */
  page?: number;
  /** 페이지 크기 (기본값: 50, 최대: 100) */
  pageSize?: number;
}

/**
 * 검색 결과 - 폴더 아이템
 */
export interface SearchFolderItem {
  id: string;
  name: string;
  type: 'folder';
  /** 폴더의 전체 경로 */
  path: string;
  /** 부모 폴더 ID (루트인 경우 null) */
  parentId: string | null;
  updatedAt: string;
}

/**
 * 검색 결과 - 파일 아이템
 */
export interface SearchFileItem {
  id: string;
  name: string;
  type: 'file';
  /** 파일이 위치한 폴더의 경로 */
  path: string;
  /** 파일이 속한 폴더 ID */
  folderId: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** MIME 타입 */
  mimeType: string;
  updatedAt: string;
}

/**
 * 검색 결과 아이템 (Union Type)
 */
export type SearchResultItem = SearchFolderItem | SearchFileItem;

/**
 * 검색 응답
 */
export interface SearchResponse {
  /** 검색 결과 목록 */
  results: SearchResultItem[];
  /** 페이지네이션 정보 */
  pagination: PaginationInfo;
  /** 검색어 */
  keyword: string;
}

// ============================================
// 검색 내역 (Search History)
// ============================================

/**
 * 검색 내역 아이템
 */
export interface SearchHistoryItem {
  id: string;
  keyword: string;
  searchedAt: string;
}

/**
 * 검색 내역 조회 응답
 */
export interface SearchHistoryResponse {
  items: SearchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 검색 내역 전체 삭제 응답
 */
export interface DeleteAllSearchHistoryResponse {
  deletedCount: number;
}

// ============================================
// 250.동기화 (Sync Event)
// ============================================

/**
 * 동기화 이벤트 상태
 */
export type SyncEventStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

/**
 * 동기화 이벤트 타입
 */
export type SyncEventType = 'CREATE' | 'MOVE' | 'DELETE' | 'RENAME' | 'TRASH' | 'RESTORE' | 'PURGE';

/**
 * 동기화 이벤트 상태 응답
 */
export interface SyncEventStatusResponse {
  id: string;
  eventType: SyncEventType;
  targetType: 'FILE' | 'FOLDER';
  status: SyncEventStatus;
  progress: number;
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

/**
 * 동기화 진행률 상세 정보
 */
export interface SyncProgressInfo {
  /** 진행률 (0-100) */
  percent: number;
  /** 완료된 청크 수 */
  completedChunks?: number;
  /** 전체 청크 수 */
  totalChunks?: number;
  /** 전송된 바이트 */
  bytesTransferred?: number;
  /** 전체 바이트 */
  totalBytes?: number;
}

/**
 * 동기화 상세 진행률 상태
 */
export type SyncProgressStatus = 'IDLE' | 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

/**
 * 동기화 진행률 응답 (상세)
 * GET /files/sync-events/:syncEventId/progress
 */
export interface SyncProgressResponse {
  /** 동기화 이벤트 ID */
  syncEventId: string;
  /** 파일 ID */
  fileId?: string | null;
  /** 이벤트 타입 */
  eventType?: SyncEventType;
  /** 상태 */
  status: SyncProgressStatus;
  /** 진행률 정보 */
  progress?: SyncProgressInfo;
  /** 처리 시작 시간 */
  startedAt?: string;
  /** 마지막 업데이트 시간 */
  updatedAt?: string;
  /** 에러 메시지 */
  errorMessage?: string | null;
  /** 상태 메시지 */
  message?: string;
}

/**
 * 파일 동기화 상태 응답
 */
export interface FileSyncStatusResponse {
  fileId: string;
  storageStatus: {
    cache: 'AVAILABLE' | 'MISSING';
    nas: 'AVAILABLE' | 'SYNCING' | 'ERROR';
  };
  activeSyncEvent?: {
    id: string;
    eventType: string;
    status: string;
    progress: number;
    createdAt: string;
  };
}

// ============================================
// API 로그 타입
// ============================================

export interface FileApiLogEntry {
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

// ============================================
// 202.다운로드 (Download with Range Request)
// ============================================

/**
 * 다운로드 파일 상태
 */
export type DownloadFileStatus =
  | 'pending'      // 대기 중
  | 'downloading'  // 다운로드 중
  | 'paused'       // 일시정지
  | 'verifying'    // 체크섬 검증 중
  | 'completed'    // 완료 (검증 성공)
  | 'error'        // 오류
  | 'cancelled';   // 취소됨

/**
 * 다운로드 진행 상태 (이어받기용)
 */
export interface DownloadProgress {
  fileId: string;
  etag: string;
  totalSize: number;
  downloadedSize: number;
  chunks: Blob[];
}

/**
 * Range 다운로드 옵션
 */
export interface RangeDownloadOptions {
  /** 시작 바이트 */
  start?: number;
  /** 끝 바이트 */
  end?: number;
  /** ETag for safe resume (If-Range 헤더) */
  ifRange?: string;
}

/**
 * 병렬 다운로드 옵션
 */
export interface ParallelDownloadOptions {
  /** 청크 크기 (기본: 10MB) */
  chunkSize?: number;
  /** 동시 다운로드 수 (기본: 4) */
  concurrency?: number;
  /** 진행률 콜백 */
  onProgress?: (percent: number, downloadedBytes: number, totalBytes: number) => void;
}

/**
 * Content-Range 정보
 */
export interface ContentRange {
  start: number;
  end: number;
  total: number;
}

/**
 * 다운로드 응답 (메타데이터 포함)
 */
export interface DownloadResponse {
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
  contentRange?: ContentRange;
}

/**
 * 체크섬 검증 결과
 */
export interface ChecksumVerificationResult {
  isValid: boolean;
  expected: string;
  actual: string;
}

/**
 * 다운로드 파일 정보 (useDownload 훅용)
 */
export interface DownloadFile {
  /** 고유 ID (클라이언트 생성) */
  id: string;
  /** 파일 ID */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** 다운로드 상태 */
  status: DownloadFileStatus;
  /** 진행률 (0-100) */
  progress: number;
  /** 다운로드된 크기 */
  downloadedSize: number;
  /** ETag (이어받기용) */
  etag?: string;
  /** 서버에서 받은 체크섬 */
  serverChecksum?: string;
  /** 오류 메시지 */
  error?: string;
  /** 병렬 다운로드 사용 여부 */
  useParallel: boolean;
  /** 이어받기용 청크 저장 */
  chunks?: Blob[];
  /** 체크섬 검증 결과 */
  checksumVerified?: boolean;
}

/**
 * localStorage에 저장할 다운로드 세션 정보 (이어받기용)
 */
export interface StoredDownloadSession {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  downloadedSize: number;
  etag: string;
  serverChecksum?: string;
  useParallel: boolean;
  createdAt: string;
}
