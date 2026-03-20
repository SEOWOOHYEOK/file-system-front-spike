/**
 * 파일 공유 관련 타입 정의
 * 600.나의 권한 / 700.공유요청 생성 / 701.보낸 공유 관리 / 702.받은 요청 관리 / 710.외부 접근
 */

// ─── Enum 타입 ───

/** 공유 대상 유형 */
export type ShareTargetUserType = 'INTERNAL' | 'EXTERNAL';

/** 공유 대상 타입 (요청 생성 시 사용) */
export type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
export type SharePermissionType = 'VIEW' | 'DOWNLOAD';

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 내가 보낸 공유 통합 상태 (ShareRequest + PublicShare) */
export type MySentShareStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'  // ShareRequest
  | 'ACTIVE' | 'REVOKED';                              // PublicShare

/** 가용성 확인 결과 상태 */
export type AvailabilityStatus = 'AVAILABLE' | 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';

/** 내가 보낸 공유 출처 */
export type MySentShareSource = 'SHARE_REQUEST' | 'PUBLIC_SHARE';

// ─── 공유 모달용 파일 타입 (폴더 API 통합) ───

/**
 * 공유 모달에서 사용하는 파일 아이템
 * api-guide-folder.md 의 FileListItemInFolder 기반이며,
 * 기본 { id, name } 타입과도 호환됩니다.
 */
/** 등록자 정보 (공유용) */
interface ShareCreatedByUser {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
}

export interface ShareableFile {
  /** 파일 ID (UUID) */
  id: string;
  /** 파일명 */
  name: string;
  /** 파일 크기 (bytes) - 폴더 API에서 제공 */
  size?: number;
  /** MIME 타입 - 폴더 API에서 제공 */
  mimeType?: string;
  /** 스토리지 상태 - 폴더 API에서 제공 */
  storageStatus?: { cache: string | null; nas: string | null };
  /** 파일 등록자 정보 - 폴더 API에서 제공 */
  createdBy?: ShareCreatedByUser | null;
  /** PENDING 작업 요청 - 폴더 API에서 제공 */
  pendingActionRequest?: {
    id: string;
    type: 'MOVE' | 'DELETE';
    status: 'PENDING';
    requestedAt: string;
  } | null;
}

/** 파일 유효성 경고 */
export interface FileWarning {
  fileId: string;
  fileName: string;
  type: 'pending_move' | 'pending_delete' | 'storage_unavailable' | 'storage_syncing';
  message: string;
}

// ─── 공통 타입 ───

/** 공유 대상 */
export interface ShareTarget {
  /** 대상 타입 */
  type: ShareTargetType;
  /** 사용자 ID (UUID) */
  userId: string;
}

/** 권한 */
export interface SharePermission {
  /** 권한 타입 */
  type: SharePermissionType;
  /** 최대 다운로드 횟수 (DOWNLOAD 권한일 때, 선택적) */
  maxDownloads?: number;
}

// ─── Enriched 타입 (파일/사용자 상세 정보) ───

/** 파일 상세 정보 */
export interface FileDetail {
  /** 파일 ID (UUID) */
  id: string;
  /** 파일명 (확장자 포함) */
  name: string;
  /** MIME 타입 (예: application/pdf) */
  mimeType: string;
  /** 파일 크기 (bytes) */
  sizeBytes: number;
}

/** 내부 사용자 상세 정보 */
export interface InternalUserDetail {
  /** 사용자 구분 타입 */
  type: 'INTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 부서명 */
  department: string;
  /** 직급/직책 */
  position?: string;
}

/** 외부 사용자 상세 정보 */
export interface ExternalUserDetail {
  /** 사용자 구분 타입 */
  type: 'EXTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 회사명 */
  company?: string;
  /** 소속 부서명 */
  department?: string;
  /** 연락처 */
  phone?: string;
}

/** 사용자 상세 정보 (내부 또는 외부) */
export type UserDetail = InternalUserDetail | ExternalUserDetail;

/** 사용자 상세 정보가 포함된 공유 대상 */
export interface EnrichedShareTarget {
  /** 대상 타입 */
  type: ShareTargetType;
  /** 사용자 ID (UUID) */
  userId: string;
  /** 대상 사용자 상세 정보 */
  userDetail?: UserDetail;
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

// ─── 600. 나의 권한 ───

/** 개별 권한 항목 */
export interface PermissionItem {
  /** 권한 코드 */
  code: string;
  /** 권한 설명 (한글) */
  description: string;
}

/** 카테고리별 권한 그룹 */
export interface PermissionGroup {
  /** 카테고리명 */
  category: string;
  /** 해당 카테고리의 권한 목록 */
  permissions: PermissionItem[];
}

/** GET /v1/users/me/permissions 응답 */
export interface MyPermissionResponse {
  /** 역할 ID (UUID) */
  roleId: string;
  /** 역할명 (ADMIN, MANAGER, USER, GUEST) */
  roleName: string;
  /** 역할 설명 (한글) */
  roleDescription: string;
  /** 보유 권한 코드 플랫 목록 (권한 체크용) */
  permissions: string[];
  /** 카테고리별 권한 그룹 (UI 표시용) */
  permissionGroups: PermissionGroup[];
}

// ─── 700. 요청 타입 ───

/** POST /v1/file-shares-requests/requests/check-availability 요청 */
export interface CheckAvailabilityRequest {
  /** 확인할 파일 ID 목록 (UUID[]) */
  fileIds: string[];
  /** 확인할 공유 대상 목록 */
  targets: ShareTarget[];
}

/** POST /v1/file-shares-requests/requests 요청 */
export interface CreateShareRequestRequest {
  /** 공유할 파일 ID 목록 (UUID[]) */
  fileIds: string[];
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 부여할 권한 */
  permission: SharePermission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
  /**
   * 승인 대상자 ID (UUID)
   * - FILE_SHARE_DIRECT 권한: 생략 가능 (자동 승인)
   * - FILE_SHARE_REQUEST 권한: 필수
   */
  designatedApproverId?: string;
}

// ─── 702. 요청 타입 ───

/** POST /v1/file-shares-requests/received/:id/approve 요청 */
export interface ApproveReceivedRequestBody {
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** POST /v1/file-shares-requests/received/:id/reject 요청 */
export interface RejectReceivedRequestBody {
  /** 반려 코멘트 (필수) */
  comment: string;
}

// ─── 700. 응답 타입 ───

/** 공유 대상자 */
export interface ShareTargetUser {
  /** 사용자 ID (UUID) */
  id: string;
  /** 사용자 유형 */
  type: ShareTargetUserType;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 부서명 */
  department: string;
  /** Role 이름 (미부여 시 null) */
  roleName: string | null;
  /** 활성 상태 */
  isActive: boolean;
}

/** 승인자 역할 */
export interface ApproverRole {
  /** 역할 ID (UUID) */
  id: string;
  /** 역할 이름 */
  name: string;
  /** 역할 설명 */
  description: string | null;
}

/** 승인자 응답 */
export interface ApproverResponse {
  /** 사용자 ID (UUID) */
  id: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 사번 */
  employeeNumber: string;
  /** 부서명 */
  departmentName: string | null;
  /** 직책 */
  positionName: string | null;
  /** 역할 정보 */
  role: ApproverRole;
}

/** 가용성 확인 결과 항목 */
export interface AvailabilityResultItem {
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 공유 대상 */
  target: ShareTarget;
  /** 대상 사용자 이름 */
  targetName?: string;
  /** 가용성 상태 */
  status: AvailabilityStatus;
  /** 충돌 정보 (status가 AVAILABLE이 아닌 경우) */
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

/** POST /v1/file-shares-requests/requests/check-availability 응답 */
export interface CheckAvailabilityResponse {
  /** 전체 가용 여부 (모든 조합이 AVAILABLE이면 true) */
  available: boolean;
  /** 각 (파일, 대상) 조합별 가용성 결과 */
  results: AvailabilityResultItem[];
}

/** 공유 요청 응답 (700·701·702 공통) */
export interface ShareRequestResponse {
  /** 공유 요청 ID (UUID) */
  id: string;
  /** 요청 상태 */
  status: ShareRequestStatus;
  /** 공유할 파일 ID 목록 */
  fileIds: string[];
  /** 공유 파일 상세 정보 목록 (이름, MIME타입, 크기) */
  files?: FileDetail[];
  /** 요청자 ID (UUID) */
  requesterId: string;
  /** 요청자 상세 정보 (이름, 부서, 이메일 등) */
  requesterDetail?: InternalUserDetail;
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 공유 대상 상세 정보 목록 (사용자 이름, 부서, 이메일 등 포함) */
  targetDetails?: EnrichedShareTarget[];
  /** 부여할 권한 */
  permission: SharePermission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
  /** 지정 승인 대상자 ID (UUID) */
  designatedApproverId: string;
  /** 지정 승인자 상세 정보 (이름, 부서, 이메일 등) */
  designatedApproverDetail?: InternalUserDetail;
  /** 실제 승인/반려 처리자 ID (UUID) */
  approverId?: string;
  /** 실제 승인/반려 처리자 상세 정보 */
  approverDetail?: InternalUserDetail;
  /** 결정일시 (ISO 8601) */
  decidedAt?: string;
  /** 결정 코멘트 */
  decisionComment?: string;
  /** 자동 승인 여부 */
  isAutoApproved: boolean;
  /** 생성된 공유 ID 목록 */
  publicShareIds: string[];
  /** 요청일시 (ISO 8601) */
  requestedAt: string;
}

// ─── 701-A. 내가 보낸 결제 요청 (ShareRequest) ───

/** 내가 보낸 결제 요청 목록 아이템 (701-A) */
export interface MySentShareRequestItem {
  /** 항목 출처 (항상 'SHARE_REQUEST') */
  source: 'SHARE_REQUEST';
  /** 결제 요청 ID (UUID) */
  id: string;
  /** 상태 */
  status: ShareRequestStatus;
  /** 파일 ID 목록 (다건 가능) */
  fileIds: string[];
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 요청자 ID (UUID) */
  ownerId: string;
}

// ─── 701-B. 내가 보낸 공유 (PublicShare) 응답 타입 ───

/** 내가 보낸 공유 통합 목록 아이템 */
export interface MySentShareItem {
  /** 항목 출처 */
  source: MySentShareSource;
  /** ID (ShareRequest 또는 PublicShare UUID) */
  id: string;
  /** 상태 */
  status: string;
  /** 파일 ID 목록 */
  fileIds: string[];
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 소유자/요청자 ID (UUID) */
  ownerId: string;
}

/** 공유 상세 (PublicShare) */
export interface PublicShareResponse {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 소유자 ID (UUID) */
  ownerId: string;
  /** 외부 사용자 ID (UUID) */
  externalUserId: string;
  /** 권한 목록 */
  permissions: string[];
  /** 최대 뷰 횟수 */
  maxViewCount?: number;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 */
  maxDownloadCount?: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601) */
  expiresAt?: string;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 취소 여부 */
  isRevoked: boolean;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  updatedAt?: string;
  /** 차단일시 (ISO 8601) */
  blockedAt?: string;
  /** 차단자 ID (UUID) */
  blockedBy?: string;
}

/** 공유 취소(철회) 응답 */
export interface RevokeShareResponse {
  /** 공유 ID (UUID) */
  id: string;
  /** 취소 여부 */
  isRevoked: boolean;
}

// ─── 710. 응답 타입 ───

/** 파일 정보 (목록 아이템 내 포함) */
export interface MyShareFileInfo {
  /** 파일 ID (UUID) */
  id: string;
  /** 파일명 */
  name: string;
  /** 파일 크기 (bytes) */
  sizeBytes: number;
  /** MIME 타입 */
  mimeType: string;
}

/** 공유자 정보 (목록 아이템 내 포함) */
export interface MyShareUserInfo {
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 부서 */
  department: string | null;
}

/** 나에게 공유된 파일 목록 아이템 */
export interface MyShareListItem {
  /** 공유 ID (UUID) */
  id: string;
  /** 권한 목록 */
  permissions: string[];
  /** 상태 (ACTIVE / EXPIRED) */
  status: string;
  /** 만료일시 (ISO 8601) */
  expiresAt: string | null;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 최대 뷰 횟수 */
  maxViewCount: number | null;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 */
  maxDownloadCount: number | null;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 파일 정보 */
  fileInfo: MyShareFileInfo | null;
  /** 공유자 정보 */
  userInfo: MyShareUserInfo;
}

/** 공유 상세 정보 (710 전용) */
export interface ShareDetail {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** MIME 타입 */
  mimeType: string;
  /** 권한 목록 */
  permissions: string[];
  /** 최대 뷰 횟수 */
  maxViewCount?: number;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 */
  maxDownloadCount?: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601) */
  expiresAt?: string;
}

/** 공유 상세 조회 + 콘텐츠 토큰 발급 응답 */
export interface ShareDetailResponse {
  /** 공유 정보 */
  share: ShareDetail;
  /** 파일 접근용 일회성 토큰 */
  contentToken: string;
  /** 콘텐츠 토큰 만료 시간 (ISO 8601) */
  tokenExpiresAt: string;
}
