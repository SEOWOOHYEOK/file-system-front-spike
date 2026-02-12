/**
 * 710. 파일 외부공유 접근 API Client
 * 나에게 공유된 파일 목록 조회, 상세 조회, 콘텐츠 보기, 다운로드
 * apiClient를 사용하여 내부 인증 토큰 자동 첨부
 */
import apiClient from './apiClient';
import type {
  PaginatedResponse,
  MyShareListItem,
  ShareDetailResponse,
} from '../types/file-share.types';

// ─── Query parameter interfaces ───

export interface MyShareListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── API ───

export const externalFileAccessApi = {
  /**
   * 나에게 공유된 파일 목록
   * GET /v1/file-shares-requests/me
   */
  getMyShares: async (
    params?: MyShareListParams,
  ): Promise<PaginatedResponse<MyShareListItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<MyShareListItem>>(
      '/file-shares-requests/me',
      { params },
    );
    return data;
  },

  /**
   * 공유 상세 조회 + 콘텐츠 토큰 발급
   * GET /v1/file-shares-requests/:shareId
   */
  getShareDetail: async (shareId: string): Promise<ShareDetailResponse> => {
    const { data } = await apiClient.get<ShareDetailResponse>(
      `/file-shares-requests/${shareId}`,
    );
    return data;
  },

  /**
   * 파일 콘텐츠 조회 (뷰어용 - inline)
   * GET /v1/file-shares-requests/:shareId/content?token=...
   */
  getContent: async (shareId: string, contentToken: string): Promise<Blob> => {
    const { data } = await apiClient.get(
      `/file-shares-requests/${shareId}/content`,
      {
        params: { token: contentToken },
        responseType: 'blob',
      },
    );
    return data;
  },

  /**
   * 파일 다운로드 (attachment)
   * GET /v1/file-shares-requests/:shareId/download?token=...
   */
  downloadFile: async (
    shareId: string,
    contentToken: string,
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await apiClient.get(
      `/file-shares-requests/${shareId}/download`,
      {
        params: { token: contentToken },
        responseType: 'blob',
      },
    );

    // Content-Disposition에서 파일명 추출
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    return { blob: response.data, filename };
  },
};
