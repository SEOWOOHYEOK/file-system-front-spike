/**
 * 공유 요청 관련 타입 정의
 * 700.공유요청 / 520.관리자-공유요청 API
 */

// ─── Enum 타입 ───

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 공유 대상 타입 */
export type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
export type SharePermissionType = 'VIEW' | 'DOWNLOAD';

/** 가용성 상태 */
export type ShareAvailabilityStatus = 'AVAILABLE' | 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';

/** 공유 항목 출처 */
export type ShareItemSource = 'ACTIVE_SHARE' | 'PENDING_REQUEST';

// ─── 공통 타입 ───

/** 공유 대상 */
export interface ShareTarget {
  type: ShareTargetType;
  userId: string;
}

/** 권한 */
export interface SharePermission {
  type: SharePermissionType;
  maxDownloads?: number;
}

/** 내부 사용자 정보 */
export interface InternalUserDetail {
  type: 'INTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  department: string;
  position?: string;
}

/** 외부 사용자 정보 */
export interface ExternalUserDetail {
  type: 'EXTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  company?: string;
  department?: string;
  phone?: string;
}

/** 사용자 정보 (내부 또는 외부) */
export type UserDetail = InternalUserDetail | ExternalUserDetail;

// ─── 요청 타입 ───

/** POST /v1/share-requests/check-availability 요청 */
export interface CheckAvailabilityRequest {
  fileIds: string[];
  targets: ShareTarget[];
}

/** POST /v1/share-requests 요청 */
export interface CreateShareRequestRequest {
  fileIds: string[];
  targets: ShareTarget[];
  permission: SharePermission;
  startAt: string;
  endAt: string;
  reason: string;
}

/** POST /v1/admin/share-requests/:id/approve 요청 */
export interface ApproveRequest {
  comment?: string;
}

/** POST /v1/admin/share-requests/:id/reject 요청 */
export interface RejectRequest {
  comment: string;
}

/** POST /v1/admin/share-requests/bulk-approve 요청 */
export interface BulkApproveRequest {
  ids: string[];
  comment?: string;
}

/** POST /v1/admin/share-requests/bulk-reject 요청 */
export interface BulkRejectRequest {
  ids: string[];
  comment: string;
}

// ─── 응답 타입 ───

/** 공유 요청 응답 (공통) */
export interface ShareRequestResponse {
  id: string;
  status: ShareRequestStatus;
  fileIds: string[];
  requesterId: string;
  targets: ShareTarget[];
  permission: SharePermission;
  startAt: string;
  endAt: string;
  reason: string;
  approverId?: string;
  decidedAt?: string;
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];
  requestedAt: string;
}

/** 가용성 확인 결과 항목 */
export interface AvailabilityResultItem {
  fileId: string;
  fileName: string;
  target: ShareTarget;
  targetName?: string;
  status: ShareAvailabilityStatus;
  conflict?: {
    conflictType: 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';
    fileId: string;
    targetUserId: string;
    publicShareId?: string;
    shareRequestId?: string;
    requestedAt?: string;
    requesterName?: string;
  };
}

/** 가용성 확인 응답 */
export interface CheckAvailabilityResponse {
  available: boolean;
  results: AvailabilityResultItem[];
}

/** 상태별 카운트 요약 응답 */
export interface ShareRequestSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
}

/** 관리자용 공유 요청 상세 응답 */
export interface ShareRequestAdminDetail {
  id: string;
  status: ShareRequestStatus;
  fileIds: string[];
  requesterId: string;
  requester?: InternalUserDetail;
  targets: Array<{
    type: string;
    userId: string;
    userDetail?: UserDetail;
  }>;
  permission: SharePermission;
  startAt: string;
  endAt: string;
  reason: string;
  approverId?: string;
  approver?: InternalUserDetail;
  decidedAt?: string;
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];
  requestedAt: string;
  updatedAt?: string;
}

/** 일괄 결정 응답 항목 */
export interface BulkDecisionItem {
  id: string;
  success: boolean;
  error?: string;
}

/** 일괄 결정 응답 */
export interface BulkDecisionResponse {
  processedCount: number;
  items: BulkDecisionItem[];
}

/** 공유 항목 (대상자별/파일별 조회용) */
export interface ShareItem {
  source: ShareItemSource;
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };
  requester: InternalUserDetail;
  target: UserDetail;
  approver?: InternalUserDetail;
  isAutoApproved?: boolean;
  decidedAt?: string;
  decisionComment?: string;
  reason: string;
  permission: string;
  startAt: string;
  endAt: string;
  // ACTIVE_SHARE 전용
  publicShareId?: string;
  currentViewCount?: number;
  currentDownloadCount?: number;
  isBlocked?: boolean;
  sharedAt?: string;
  // PENDING_REQUEST 전용
  shareRequestId?: string;
  requestedAt?: string;
}

/** 요약 통계 */
export interface ShareSummary {
  activeShareCount: number;
  pendingRequestCount: number;
  totalViewCount: number;
  totalDownloadCount: number;
}

// ─── 페이지네이션 ───

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 대상자별 공유 조회 응답 */
export interface SharesByTargetResponse extends PaginatedResponse<ShareItem> {
  target: UserDetail;
  summary: ShareSummary;
}

/** 파일별 공유 조회 응답 */
export interface SharesByFileResponse extends PaginatedResponse<ShareItem> {
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };
  summary: ShareSummary;
}

// ─── 관리자 목록 조회 쿼리 ───

export interface AdminShareRequestListQuery {
  status: ShareRequestStatus;
  q?: string;
  requesterId?: string;
  fileId?: string;
  targetUserId?: string;
  requestedFrom?: string;
  requestedTo?: string;
  periodFrom?: string;
  periodTo?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** 내 공유 요청 목록 쿼리 */
export interface MyShareRequestListQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: ShareRequestStatus;
}
