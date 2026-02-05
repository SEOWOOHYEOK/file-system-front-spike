/**
 * File API Client
 * 200.파일 API
 */
import axios, { AxiosError } from 'axios';
import type {
  FileInfoResponse,
  UploadFileResponse,
  RenameFileRequest,
  RenameFileResponse,
  MoveFileRequest,
  MoveFileResponse,
  DeleteFileResponse,
  ConflictStrategy,
  FileApiLogEntry,
  InitiateMultipartRequest,
  InitiateMultipartResponse,
  UploadPartResponse,
  CompleteMultipartRequest,
  CompleteMultipartResponse,
  SessionStatusResponse,
  AbortSessionResponse,
  SyncEventStatusResponse,
  FileSyncStatusResponse,
  SyncProgressResponse,
  DownloadResponse,
  RangeDownloadOptions,
  ParallelDownloadOptions,
  ContentRange,
  DownloadProgress,
} from '../types/file.types';

const api = axios.create({
  baseURL: '/v1',
});

// API 로그 콜백
let logCallback: ((log: FileApiLogEntry) => void) | null = null;

export function setFileLogCallback(callback: ((log: FileApiLogEntry) => void) | null) {
  logCallback = callback;
}

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
  data?: unknown,
  config?: { headers?: Record<string, string>; responseType?: 'blob' | 'json' }
): Promise<T> {
  const startTime = Date.now();
  const logEntry: FileApiLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    method,
    url,
    status: 0,
    duration: 0,
    request: data,
    timestamp: new Date(),
  };

  try {
    const response = await api.request<T>({
      method,
      url,
      data,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(config?.headers || {}),
      },
      responseType: config?.responseType || 'json',
    });

    logEntry.status = response.status;
    logEntry.duration = Date.now() - startTime;
    logEntry.response = config?.responseType === 'blob' ? '[Blob Data]' : response.data;
    
    if (logCallback) {
      logCallback(logEntry);
    }

    return response.data;
  } catch (error) {
    logEntry.duration = Date.now() - startTime;
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logEntry.status = axiosError.response?.status || 0;
      logEntry.error = axiosError.message;
      logEntry.response = axiosError.response?.data;
    } else {
      logEntry.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    if (logCallback) {
      logCallback(logEntry);
    }
    
    throw error;
  }
}

// ============================================
// 200.파일 API
// ============================================

export const fileApi = {
  /**
   * 파일 업로드 (100MB 미만)
   * POST /v1/files/upload
   */
  upload: async (
    token: string,
    file: File,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', folderId);
    if (conflictStrategy) {
      formData.append('conflictStrategy', conflictStrategy);
    }

    return apiCall<UploadFileResponse>(
      'POST',
      '/files/upload',
      token,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  /**
   * 다중 파일 업로드
   * POST /v1/files/upload/many
   */
  uploadMany: async (
    token: string,
    files: File[],
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<UploadFileResponse[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('folderId', folderId);
    if (conflictStrategy) {
      formData.append('conflictStrategy', conflictStrategy);
    }

    return apiCall<UploadFileResponse[]>(
      'POST',
      '/files/upload/many',
      token,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  /**
   * 파일 정보 조회 (체크섬 포함)
   * GET /v1/files/:fileId
   * 병렬 다운로드 전 체크섬을 미리 획득하기 위해 사용
   */
  getInfo: (token: string, fileId: string): Promise<FileInfoResponse> => {
    console.log('[fileApi.getInfo] Called for fileId:', fileId);
    console.trace('[fileApi.getInfo] Call stack:');
    return apiCall<FileInfoResponse>('GET', `/files/${fileId}`, token);
  },

  /**
   * 파일 다운로드 (기본)
   * GET /v1/files/:fileId/download
   * Returns: { blob: Blob, filename: string }
   */
  download: async (
    token: string,
    fileId: string
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await axios.get(`/v1/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });

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

  /**
   * 파일 다운로드 (메타데이터 포함)
   * ETag, 체크섬 등 응답 헤더 정보를 포함하여 반환
   * GET /v1/files/:fileId/download
   */
  downloadWithMetadata: async (
    token: string,
    fileId: string
  ): Promise<DownloadResponse> => {
    const response = await axios.get(`/v1/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });

    // 파일명 추출
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    // ETag 추출 (따옴표 제거)
    const etagHeader = response.headers['etag'];
    const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;

    // 체크섬 추출
    const checksum = response.headers['x-checksum-sha256'];

    // Content-Length
    const contentLength = parseInt(response.headers['content-length'] || '0');

    return {
      blob: response.data,
      filename,
      etag,
      checksum,
      totalSize: contentLength || response.data.size,
      isPartial: false,
    };
  },

  /**
   * 부분 다운로드 (Range 요청)
   * GET /v1/files/:fileId/download with Range header
   */
  downloadRange: async (
    token: string,
    fileId: string,
    options: RangeDownloadOptions
  ): Promise<DownloadResponse> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    // Range 헤더 구성
    if (options.start !== undefined || options.end !== undefined) {
      const start = options.start ?? '';
      const end = options.end ?? '';
      headers['Range'] = `bytes=${start}-${end}`;
    }

    // If-Range 헤더 (안전한 이어받기용)
    if (options.ifRange) {
      headers['If-Range'] = `"${options.ifRange}"`;
    }

    const response = await axios.get(`/v1/files/${fileId}/download`, {
      headers,
      responseType: 'blob',
      validateStatus: (status) => status === 200 || status === 206 || status === 416,
    });

    // 416 Range Not Satisfiable 처리
    if (response.status === 416) {
      const contentRange = response.headers['content-range'];
      throw new Error(`Range not satisfiable: ${contentRange || 'unknown size'}`);
    }

    // 파일명 추출
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    // ETag 추출
    const etagHeader = response.headers['etag'];
    const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;

    // 체크섬 추출
    const checksum = response.headers['x-checksum-sha256'];

    // Content-Range 파싱 (206 응답시)
    let contentRange: ContentRange | undefined;
    let totalSize = response.data.size;

    if (response.status === 206) {
      const contentRangeHeader = response.headers['content-range'];
      if (contentRangeHeader) {
        const match = contentRangeHeader.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (match) {
          contentRange = {
            start: parseInt(match[1]),
            end: parseInt(match[2]),
            total: parseInt(match[3]),
          };
          totalSize = contentRange.total;
        }
      }
    }

    return {
      blob: response.data,
      filename,
      etag,
      checksum,
      totalSize,
      isPartial: response.status === 206,
      contentRange,
    };
  },

  /**
   * 진행률 추적 다운로드
   * ReadableStream을 사용하여 다운로드 진행률을 추적
   * GET /v1/files/:fileId/download
   */
  downloadWithProgress: async (
    token: string,
    fileId: string,
    onProgress: (percent: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<DownloadResponse> => {
    const response = await fetch(`/v1/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    // 파일명 추출
    const contentDisposition = response.headers.get('content-disposition');
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    // 메타데이터 추출
    const etagHeader = response.headers.get('etag');
    const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;
    const checksum = response.headers.get('x-checksum-sha256') || undefined;
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    if (!response.body) {
      throw new Error('Response body is not readable');
    }

    // ReadableStream으로 진행률 추적
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      const percent = contentLength > 0 
        ? Math.round((receivedLength / contentLength) * 100) 
        : 0;
      onProgress(percent, receivedLength, contentLength);
    }

    const blob = new Blob(chunks as BlobPart[]);

    return {
      blob,
      filename,
      etag,
      checksum,
      totalSize: contentLength || blob.size,
      isPartial: false,
    };
  },

  /**
   * 이어받기 (Resume Download)
   * If-Range 헤더를 사용하여 파일 변경 감지
   * 파일이 변경된 경우 처음부터 다시 다운로드
   */
  resumeDownload: async (
    token: string,
    progress: DownloadProgress,
    onProgress?: (percent: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<{ blob: Blob; isRestarted: boolean; etag: string; checksum?: string }> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Range: `bytes=${progress.downloadedSize}-`,
    };

    // If-Range로 파일 변경 감지
    if (progress.etag) {
      headers['If-Range'] = `"${progress.etag}"`;
    }

    const response = await fetch(`/v1/files/${progress.fileId}/download`, {
      headers,
    });

    // ETag 추출
    const etagHeader = response.headers.get('etag');
    const etag = etagHeader ? etagHeader.replace(/"/g, '') : progress.etag;
    const checksum = response.headers.get('x-checksum-sha256') || undefined;

    // 200 응답: 파일이 변경됨 → 처음부터 다시
    if (response.status === 200) {
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      
      if (!response.body) {
        const blob = await response.blob();
        return { blob, isRestarted: true, etag, checksum };
      }

      // 진행률 추적
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (onProgress) {
          const percent = contentLength > 0 
            ? Math.round((receivedLength / contentLength) * 100) 
            : 0;
          onProgress(percent, receivedLength, contentLength);
        }
      }

      return { blob: new Blob(chunks as BlobPart[]), isRestarted: true, etag, checksum };
    }

    // 206 응답: 이어받기 성공
    if (response.status === 206) {
      const contentRangeHeader = response.headers.get('content-range');
      let totalSize = progress.totalSize;
      
      if (contentRangeHeader) {
        const match = contentRangeHeader.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (match) {
          totalSize = parseInt(match[3]);
        }
      }

      if (!response.body) {
        const newChunk = await response.blob();
        const allChunks = [...progress.chunks, newChunk];
        return { blob: new Blob(allChunks), isRestarted: false, etag, checksum };
      }

      // 진행률 추적
      const reader = response.body.getReader();
      const newChunks: Uint8Array[] = [];
      let receivedLength = progress.downloadedSize;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        newChunks.push(value);
        receivedLength += value.length;
        if (onProgress) {
          const percent = Math.round((receivedLength / totalSize) * 100);
          onProgress(percent, receivedLength, totalSize);
        }
      }

      // 기존 청크와 새 청크 합치기
      const existingBlobs = progress.chunks;
      const newBlob = new Blob(newChunks as BlobPart[]);
      const allChunks = [...existingBlobs, newBlob];
      
      return { blob: new Blob(allChunks), isRestarted: false, etag, checksum };
    }

    // 416: Range Not Satisfiable
    if (response.status === 416) {
      throw new Error('Range not satisfiable - file may have changed');
    }

    throw new Error(`Unexpected response: ${response.status}`);
  },

  /**
   * 병렬 다운로드
   * 파일을 여러 청크로 나누어 동시에 다운로드하여 속도 향상
   */
  parallelDownload: async (
    token: string,
    fileId: string,
    totalSize: number,
    options?: ParallelDownloadOptions
  ): Promise<{ blob: Blob; etag?: string; checksum?: string }> => {
    const chunkSize = options?.chunkSize || 10 * 1024 * 1024; // 기본 10MB
    const concurrency = options?.concurrency || 4; // 기본 동시 4개
    const onProgress = options?.onProgress;

    // 청크 범위 계산
    const chunks: { index: number; start: number; end: number }[] = [];
    for (let i = 0, start = 0; start < totalSize; i++, start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, totalSize - 1);
      chunks.push({ index: i, start, end });
    }

    // 진행률 추적
    const chunkProgress = new Array(chunks.length).fill(0);
    const updateProgress = () => {
      if (!onProgress) return;
      const totalDownloaded = chunkProgress.reduce((a, b) => a + b, 0);
      const percent = Math.round((totalDownloaded / totalSize) * 100);
      onProgress(percent, totalDownloaded, totalSize);
    };

    // 동시성 제한 Promise Pool
    let etag: string | undefined;
    let checksum: string | undefined;
    
    // 중복 요청 방지를 위한 Set
    const requestedChunks = new Set<number>();

    const downloadChunk = async (chunk: { index: number; start: number; end: number }) => {
      // 이미 요청된 청크인지 확인
      if (requestedChunks.has(chunk.index)) {
        console.warn(`Skipping duplicate chunk request: ${chunk.index}`);
        return null;
      }
      requestedChunks.add(chunk.index);
      
      const response = await fetch(`/v1/files/${fileId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Range: `bytes=${chunk.start}-${chunk.end}`,
        },
      });

      if (response.status !== 206 && response.status !== 200) {
        throw new Error(`Chunk ${chunk.index} failed: ${response.status}`);
      }

      // 첫 번째 청크에서 메타데이터 추출
      if (chunk.index === 0) {
        const etagHeader = response.headers.get('etag');
        etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;
        checksum = response.headers.get('x-checksum-sha256') || undefined;
      }

      if (!response.body) {
        const blob = await response.blob();
        chunkProgress[chunk.index] = blob.size;
        updateProgress();
        return { index: chunk.index, blob };
      }

      // 스트리밍으로 진행률 추적
      const reader = response.body.getReader();
      const chunkData: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkData.push(value);
        chunkProgress[chunk.index] += value.length;
        updateProgress();
      }

      return { index: chunk.index, blob: new Blob(chunkData as BlobPart[]) };
    };

    // 순차 처리 방식 (중복 방지 보장)
    const results: { index: number; blob: Blob }[] = [];
    
    // 배치 단위로 처리 (동시에 concurrency 개수만큼 실행)
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, Math.min(i + concurrency, chunks.length));
      const batchPromises = batch.map(chunk => downloadChunk(chunk));
      const batchResults = await Promise.all(batchPromises);
      
      // null이 아닌 결과만 추가 (중복 방지로 스킵된 것 제외)
      for (const result of batchResults) {
        if (result !== null) {
          results.push(result);
        }
      }
    }

    // 청크 누락 검증
    if (results.length !== chunks.length) {
      throw new Error(`Chunk download incomplete: expected ${chunks.length}, got ${results.length}`);
    }

    // 순서대로 정렬 후 병합
    results.sort((a, b) => a.index - b.index);
    
    // 각 청크 크기 검증
    let totalDownloaded = 0;
    for (let i = 0; i < results.length; i++) {
      const expectedSize = chunks[i].end - chunks[i].start + 1;
      const actualSize = results[i].blob.size;
      if (actualSize !== expectedSize) {
        console.warn(`Chunk ${i} size mismatch: expected ${expectedSize}, got ${actualSize}`);
      }
      totalDownloaded += actualSize;
    }
    
    // 전체 크기 검증
    if (totalDownloaded !== totalSize) {
      console.warn(`Total size mismatch: expected ${totalSize}, got ${totalDownloaded}`);
    }
    
    const finalBlob = new Blob(results.map((r) => r.blob));

    return { blob: finalBlob, etag, checksum };
  },

  /**
   * 파일명 변경
   * PUT /v1/files/:fileId/rename
   */
  rename: (
    token: string,
    fileId: string,
    request: RenameFileRequest
  ): Promise<RenameFileResponse> =>
    apiCall<RenameFileResponse>('PUT', `/files/${fileId}/rename`, token, request),

  /**
   * 파일 이동
   * POST /v1/files/:fileId/move
   */
  move: (
    token: string,
    fileId: string,
    request: MoveFileRequest
  ): Promise<MoveFileResponse> =>
    apiCall<MoveFileResponse>('POST', `/files/${fileId}/move`, token, request),

  /**
   * 파일 삭제 (휴지통 이동)
   * DELETE /v1/files/:fileId
   */
  delete: (token: string, fileId: string): Promise<DeleteFileResponse> =>
    apiCall<DeleteFileResponse>('DELETE', `/files/${fileId}`, token),

  // ============================================
  // 201.멀티파트 업로드 API
  // ============================================

  /**
   * 멀티파트 업로드 초기화
   * POST /v1/files/multipart/initiate
   */
  multipartInitiate: async (
    token: string,
    request: InitiateMultipartRequest
  ): Promise<InitiateMultipartResponse> =>
    apiCall<InitiateMultipartResponse>('POST', '/files/multipart/initiate', token, request),

  /**
   * 파트 업로드
   * PUT /v1/files/multipart/:sessionId/parts/:partNumber
   */
  multipartUploadPart: async (
    token: string,
    sessionId: string,
    partNumber: number,
    data: ArrayBuffer,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<UploadPartResponse> => {
    const startTime = Date.now();
    const logEntry: FileApiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      method: 'PUT',
      url: `/files/multipart/${sessionId}/parts/${partNumber}`,
      status: 0,
      duration: 0,
      request: { sessionId, partNumber, size: data.byteLength },
      timestamp: new Date(),
    };

    try {
      const response = await axios.put<UploadPartResponse>(
        `/v1/files/multipart/${sessionId}/parts/${partNumber}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              onProgress(progressEvent.loaded, progressEvent.total);
            }
          },
        }
      );

      logEntry.status = response.status;
      logEntry.duration = Date.now() - startTime;
      logEntry.response = response.data;
      if (logCallback) logCallback(logEntry);

      return response.data;
    } catch (error) {
      logEntry.duration = Date.now() - startTime;
      if (axios.isAxiosError(error)) {
        logEntry.status = error.response?.status || 0;
        logEntry.error = error.message;
        logEntry.response = error.response?.data;
      } else {
        logEntry.error = error instanceof Error ? error.message : 'Unknown error';
      }
      if (logCallback) logCallback(logEntry);
      throw error;
    }
  },

  /**
   * 멀티파트 업로드 완료
   * POST /v1/files/multipart/:sessionId/complete
   */
  multipartComplete: async (
    token: string,
    sessionId: string,
    request?: CompleteMultipartRequest
  ): Promise<CompleteMultipartResponse> =>
    apiCall<CompleteMultipartResponse>('POST', `/files/multipart/${sessionId}/complete`, token, request),

  /**
   * 세션 상태 조회
   * GET /v1/files/multipart/:sessionId/status
   */
  multipartStatus: async (
    token: string,
    sessionId: string
  ): Promise<SessionStatusResponse> =>
    apiCall<SessionStatusResponse>('GET', `/files/multipart/${sessionId}/status`, token),

  /**
   * 업로드 취소
   * DELETE /v1/files/multipart/:sessionId
   */
  multipartAbort: async (
    token: string,
    sessionId: string
  ): Promise<AbortSessionResponse> =>
    apiCall<AbortSessionResponse>('DELETE', `/files/multipart/${sessionId}`, token),

  // ============================================
  // 250.동기화 API
  // ============================================

  /**
   * 동기화 이벤트 상태 조회
   * GET /v1/sync-events/:syncEventId
   */
  getSyncEventStatus: async (
    token: string,
    syncEventId: string
  ): Promise<SyncEventStatusResponse> =>
    apiCall<SyncEventStatusResponse>('GET', `/sync-events/${syncEventId}`, token),

  /**
   * 동기화 진행률 조회 (상세)
   * GET /v1/files/sync-events/:syncEventId/progress
   * 청크 수, 전송 바이트 등 상세 진행률 정보를 반환합니다.
   */
  getSyncProgress: async (
    token: string,
    syncEventId: string
  ): Promise<SyncProgressResponse> =>
    apiCall<SyncProgressResponse>('GET', `/files/sync-events/${syncEventId}/progress`, token),

  /**
   * 파일 동기화 상태 조회
   * GET /v1/files/:fileId/sync-status
   */
  getFileSyncStatus: async (
    token: string,
    fileId: string
  ): Promise<FileSyncStatusResponse> =>
    apiCall<FileSyncStatusResponse>('GET', `/files/${fileId}/sync-status`, token),
};

export default fileApi;
