/**
 * 807. 관리자 - 파일 공유요청 현황 및 관리 API Client
 * GET 전용 (모니터링용) - POST (승인/반려) 미사용
 *
 * Base: /v1/admin/file-shares-requests
 */
import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ─── 타입 정의 ───

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 공유 대상 타입 */
export type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
export type SharePermissionType = 'VIEW' | 'DOWNLOAD';

/** 공유 항목 출처 */
export type ShareItemSource = 'ACTIVE_SHARE' | 'PENDING_REQUEST';

/** 상태별 카운트 (A-1) */
export interface FileShareRequestSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
}

/** 파일 상세 정보 */
export interface FileDetail {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/** 내부 사용자 상세 */
export interface InternalUserDetail {
  type: 'INTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  department: string;
  position?: string;
}

/** 외부 사용자 상세 */
export interface ExternalUserDetail {
  type: 'EXTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  company?: string;
  department?: string;
  phone?: string;
}

/** 사용자 상세 (내부 or 외부) */
export type UserDetail = InternalUserDetail | ExternalUserDetail;

/** Enriched 공유 대상 */
export interface EnrichedShareTarget {
  type: ShareTargetType;
  userId: string;
  userDetail?: UserDetail;
}

/** 권한 */
export interface SharePermission {
  type: SharePermissionType;
  maxDownloads?: number;
}

/** 페이지네이션 응답 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 공유 요청 목록 아이템 (A-2) */
export interface FileShareRequestItem {
  id: string;
  status: ShareRequestStatus;
  fileIds: string[];
  files?: FileDetail[];
  requesterId: string;
  requesterDetail?: InternalUserDetail;
  targets: Array<{ type: ShareTargetType; userId: string }>;
  targetDetails?: EnrichedShareTarget[];
  permission: SharePermission;
  startAt: string;
  endAt: string;
  reason: string;
  designatedApproverId: string;
  designatedApproverDetail?: InternalUserDetail;
  approverId?: string;
  approverDetail?: InternalUserDetail;
  decidedAt?: string;
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];
  requestedAt: string;
}

/** 공유 요청 상세 (A-3) */
export interface FileShareRequestDetail {
  id: string;
  status: ShareRequestStatus;
  fileIds: string[];
  files?: FileDetail[];
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
  designatedApproverId: string;
  designatedApproverDetail?: InternalUserDetail;
  approverId?: string;
  approver?: InternalUserDetail;
  decidedAt?: string;
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];
  requestedAt: string;
  updatedAt?: string;
}

/** 공유 항목 (Q-1, Q-2) */
export interface ShareItemResult {
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

/** 대상자별 공유 조회 응답 (Q-1) */
export interface SharesByTargetResponse extends PaginatedResponse<ShareItemResult> {
  target: UserDetail;
  summary: {
    activeShareCount: number;
    pendingRequestCount: number;
    totalViewCount: number;
    totalDownloadCount: number;
  };
}

/** 파일별 공유 조회 응답 (Q-2) */
export interface SharesByFileResponse extends PaginatedResponse<ShareItemResult> {
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };
  summary: {
    activeShareCount: number;
    pendingRequestCount: number;
    totalViewCount: number;
    totalDownloadCount: number;
  };
}

/** 목록 조회 쿼리 파라미터 */
export interface FileShareRequestListQuery {
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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Q-3, Q-4: 그룹 목록 타입 (2026-02-12 추가) ───

/** 그룹 목록 조회 쿼리 파라미터 (Q-3, Q-4 공통) */
export interface GroupListQuery {
  status?: ShareRequestStatus;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 요청 간략 정보 (그룹 목록의 중첩 아이템) */
export interface ShareRequestBrief {
  id: string;
  status: ShareRequestStatus;
  requester: InternalUserDetail;
  targets: UserDetail[];
  permission: string;
  maxDownloads?: number;
  currentDownloadCount?: number;
  currentViewCount?: number;
  startAt: string;
  endAt: string;
  requestedAt: string;
  reason: string;
  approver?: InternalUserDetail;
  decidedAt?: string;
}

/** 그룹 요약 정보 (파일별/대상자별 공통) */
export interface GroupSummary {
  totalRequestCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  canceledCount: number;
  activeShareCount: number;
}

/** 파일별 그룹 아이템 (Q-3) */
export interface FileGroupItem {
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };
  summary: GroupSummary;
  latestRequestedAt: string;
  requests: ShareRequestBrief[];
}

/** 대상자별 그룹 아이템 (Q-4) */
export interface TargetGroupItem {
  target: UserDetail;
  summary: GroupSummary;
  latestRequestedAt: string;
  requests: ShareRequestBrief[];
}

/** 파일별 그룹 목록 응답 (Q-3) */
export type FileGroupListResponse = PaginatedResponse<FileGroupItem>;

/** 대상자별 그룹 목록 응답 (Q-4) */
export type TargetGroupListResponse = PaginatedResponse<TargetGroupItem>;

// ─── API 호출 래퍼 ───

async function apiGet<T>(
  url: string,
  token: string,
  params?: Record<string, unknown>,
): Promise<T> {
  try {
    const response = await api.request<T>({
      method: 'GET',
      url,
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message: string | string[]; error: string }>;
      const message = axiosError.response?.data?.message;
      const errorMessage = Array.isArray(message) ? message.join(', ') : message || axiosError.message;
      throw new Error(errorMessage);
    }
    throw error;
  }
}

// ─── API 함수들 (GET 전용) ───

export const adminFileShareRequestApi = {
  /**
   * A-1: 상태별 카운트 조회
   * GET /v1/admin/file-shares-requests/summary
   */
  getSummary: (token: string): Promise<FileShareRequestSummary> =>
    apiGet<FileShareRequestSummary>('/admin/file-shares-requests/summary', token),

  /**
   * A-2: 요청 목록 조회 (필터 + 페이지네이션)
   * GET /v1/admin/file-shares-requests
   */
  getList: (
    token: string,
    query: FileShareRequestListQuery,
  ): Promise<PaginatedResponse<FileShareRequestItem>> => {
    const params: Record<string, unknown> = {};
    params.status = query.status;
    if (query.q) params.q = query.q;
    if (query.requesterId) params.requesterId = query.requesterId;
    if (query.fileId) params.fileId = query.fileId;
    if (query.targetUserId) params.targetUserId = query.targetUserId;
    if (query.requestedFrom) params.requestedFrom = query.requestedFrom;
    if (query.requestedTo) params.requestedTo = query.requestedTo;
    if (query.periodFrom) params.periodFrom = query.periodFrom;
    if (query.periodTo) params.periodTo = query.periodTo;
    if (query.sort) params.sort = query.sort;
    if (query.page) params.page = query.page;
    if (query.pageSize) params.pageSize = query.pageSize;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortOrder) params.sortOrder = query.sortOrder;
    return apiGet<PaginatedResponse<FileShareRequestItem>>(
      '/admin/file-shares-requests',
      token,
      params,
    );
  },

  /**
   * A-3: 요청 상세 조회
   * GET /v1/admin/file-shares-requests/:id
   */
  getDetail: (token: string, id: string): Promise<FileShareRequestDetail> =>
    apiGet<FileShareRequestDetail>(`/admin/file-shares-requests/${id}`, token),

  /**
   * Q-1: 대상자별 공유 조회
   * GET /v1/admin/file-shares-requests/by-target/:userId
   */
  getByTarget: (
    token: string,
    userId: string,
    query?: { page?: number; pageSize?: number },
  ): Promise<SharesByTargetResponse> =>
    apiGet<SharesByTargetResponse>(
      `/admin/file-shares-requests/by-target/${userId}`,
      token,
      query as Record<string, unknown>,
    ),

  /**
   * Q-2: 파일별 공유 조회
   * GET /v1/admin/file-shares-requests/by-file/:fileId
   */
  getByFile: (
    token: string,
    fileId: string,
    query?: { page?: number; pageSize?: number },
  ): Promise<SharesByFileResponse> =>
    apiGet<SharesByFileResponse>(
      `/admin/file-shares-requests/by-file/${fileId}`,
      token,
      query as Record<string, unknown>,
    ),

  /**
   * Q-3: 파일별 전체 목록 조회 (그룹핑)
   * GET /v1/admin/file-shares-requests/files
   */
  getFileGroupList: (
    token: string,
    query?: GroupListQuery,
  ): Promise<FileGroupListResponse> => {
    const params: Record<string, unknown> = {};
    if (query?.status) params.status = query.status;
    if (query?.q) params.q = query.q;
    if (query?.page) params.page = query.page;
    if (query?.pageSize) params.pageSize = query.pageSize;
    if (query?.sortBy) params.sortBy = query.sortBy;
    if (query?.sortOrder) params.sortOrder = query.sortOrder;
    return apiGet<FileGroupListResponse>(
      '/admin/file-shares-requests/files',
      token,
      params,
    );
  },

  /**
   * Q-4: 대상자별 전체 목록 조회 (그룹핑)
   * GET /v1/admin/file-shares-requests/targets
   */
  getTargetGroupList: (
    token: string,
    query?: GroupListQuery,
  ): Promise<TargetGroupListResponse> => {
    const params: Record<string, unknown> = {};
    if (query?.status) params.status = query.status;
    if (query?.q) params.q = query.q;
    if (query?.page) params.page = query.page;
    if (query?.pageSize) params.pageSize = query.pageSize;
    if (query?.sortBy) params.sortBy = query.sortBy;
    if (query?.sortOrder) params.sortOrder = query.sortOrder;
    return apiGet<TargetGroupListResponse>(
      '/admin/file-shares-requests/targets',
      token,
      params,
    );
  },
};
