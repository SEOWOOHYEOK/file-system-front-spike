/**
 * 파일 작업 요청 (File Action Request) 타입 정의
 * 이동/삭제 요청 → 승인 → 자동 실행 워크플로우
 */

// ============================================
// Enum 타입
// ============================================

/** 요청 타입 */
export type FileActionType = 'MOVE' | 'DELETE';

/** 요청 상태 */
export type FileActionRequestStatus =
  | 'PENDING'       // 승인 대기
  | 'APPROVED'      // 승인됨 (실행 직전 과도 상태)
  | 'REJECTED'      // 반려됨
  | 'CANCELED'      // 요청자가 취소
  | 'EXECUTED'      // 실행 완료 (이동/삭제 성공)
  | 'INVALIDATED'   // 무효화 (승인 시 파일 상태 변경됨)
  | 'FAILED';       // 실행 실패 (기술적 오류)

// ============================================
// 응답 타입
// ============================================

/** 파일 작업 요청 응답 */
export interface FileActionRequestResponse {
  id: string;
  type: FileActionType;
  status: FileActionRequestStatus;
  fileId: string;
  fileName: string;
  sourceFolderId?: string;
  targetFolderId?: string;
  requesterId: string;
  designatedApproverId: string;
  approverId?: string;
  reason: string;
  decisionComment?: string;
  executionNote?: string;
  requestedAt: string;
  decidedAt?: string;
  executedAt?: string;
}

/** 페이지네이션 응답 래퍼 */
export interface PaginatedFileActionResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================
// 요청 타입
// ============================================

/** 이동 요청 생성 */
export interface CreateMoveRequest {
  fileId: string;
  targetFolderId: string;
  reason: string;
  designatedApproverId: string;
}

/** 삭제 요청 생성 */
export interface CreateDeleteRequest {
  fileId: string;
  reason: string;
  designatedApproverId: string;
}

/** 승인 요청 */
export interface ApproveRequest {
  comment?: string;
}

/** 반려 요청 */
export interface RejectRequest {
  comment: string;
}

/** 일괄 승인 요청 */
export interface BulkApproveRequest {
  ids: string[];
  comment?: string;
}

/** 일괄 반려 요청 */
export interface BulkRejectRequest {
  ids: string[];
  comment: string;
}

// ============================================
// 쿼리 파라미터 타입
// ============================================

/** 내 요청 목록 쿼리 */
export interface MyRequestsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: FileActionRequestStatus;
  type?: FileActionType;
}

/** 관리자 요청 목록 쿼리 */
export interface AdminRequestsQuery extends MyRequestsQuery {
  requesterId?: string;
  fileId?: string;
  requestedFrom?: string;
  requestedTo?: string;
}

/** 상태별 요약 응답 */
export interface StatusSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
  EXECUTED: number;
  INVALIDATED: number;
  FAILED: number;
}

// ============================================
// 승인자 후보
// ============================================

/** 승인자 후보 사용자 */
export interface ApproverUser {
  id: string;
  name: string;
  isActive: boolean;
  roleId: string;
}

// ============================================
// Pending Action Request (파일/폴더 조회 시)
// ============================================

/** PENDING 작업 요청 상세 정보 (파일 단건 조회용) */
export interface PendingActionRequestDetail {
  id: string;
  type: FileActionType;
  status: 'PENDING';
  requesterId: string;
  designatedApproverId: string;
  reason: string;
  requestedAt: string;
  targetFolderId?: string;
}

/** PENDING 작업 요청 요약 정보 (폴더 목록 조회용) */
export interface PendingActionRequestSummary {
  id: string;
  type: FileActionType;
  status: 'PENDING';
  requestedAt: string;
}

// ============================================
// 에러 타입
// ============================================

/** 에러 응답 */
export interface FileActionRequestError {
  code: number;
  internalCode: string;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================
// UI 헬퍼 타입
// ============================================

/** 상태 라벨/색상 매핑 */
export interface StatusDisplayInfo {
  label: string;
  bgColor: string;
  textColor: string;
}

/** 상태별 표시 정보 */
export const STATUS_DISPLAY: Record<FileActionRequestStatus, StatusDisplayInfo> = {
  PENDING: { label: '승인 대기', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  APPROVED: { label: '승인됨', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  REJECTED: { label: '반려됨', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  CANCELED: { label: '취소됨', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  EXECUTED: { label: '실행 완료', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  INVALIDATED: { label: '무효화', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  FAILED: { label: '실행 실패', bgColor: 'bg-red-100', textColor: 'text-red-800' },
};

/** 타입별 표시 정보 */
export const TYPE_DISPLAY: Record<FileActionType, { label: string; icon: string }> = {
  MOVE: { label: '이동 요청', icon: '📂' },
  DELETE: { label: '삭제 요청', icon: '🗑️' },
};
