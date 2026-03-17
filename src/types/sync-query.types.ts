/**
 * 동기화 조회(sync-query) API 타입 정의
 * API: /v1/admin/sync-query/*
 */

/** 한글 표시 상태 */
export type SyncDisplayStatus = '정상' | '동기화 중' | '오류' | '대기';

/** 동기화 조회 쿼리 파라미터 */
export interface SyncQueryParams {
  fromDate?: string;
  toDate?: string;
  status?: SyncDisplayStatus;
  fileName?: string;
  page?: number;
  pageSize?: number;
}

/** 동기화 요약 응답 */
export interface SyncQuerySummaryResponse {
  total: number;
  counts: Record<string, number>;
}

/** 동기화 이벤트 아이템 */
export interface SyncQueryEventItem {
  id: string;
  fileName: string;
  folderPath: string;
  fileSize: number | null;
  uploaderName: string;
  uploadedAt: string;
  displayStatus: string;
  remarks: string | null;
}

/** 동기화 이벤트 목록 응답 */
export interface SyncQueryEventListResponse {
  items: SyncQueryEventItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 업로더 아이템 */
export interface SyncQueryUploader {
  userId: string;
  name: string;
}

/** 업로더 목록 응답 */
export interface SyncQueryUploadersResponse {
  uploaders: SyncQueryUploader[];
}
