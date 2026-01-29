/**
 * 멀티파트 업로드 훅
 * 대용량 파일을 청크 단위로 업로드하고 진행률을 추적합니다.
 */
import { useState, useCallback, useRef } from 'react';
import { fileApi } from '../api/fileApi';
import type {
  InitiateMultipartResponse,
  CompleteMultipartResponse,
  ConflictStrategy,
  SyncEventStatus,
} from '../types/file.types';

/**
 * 업로드 파일 상태
 */
export type UploadFileStatus = 
  | 'pending'      // 대기 중
  | 'uploading'    // 업로드 중
  | 'syncing'      // NAS 동기화 중
  | 'completed'    // 완료
  | 'error'        // 오류
  | 'cancelled';   // 취소됨

/**
 * 업로드 파일 정보
 */
export interface UploadFile {
  id: string;
  file: File;
  status: UploadFileStatus;
  uploadProgress: number;  // 업로드 진행률 (0-100)
  syncProgress: number;    // NAS 동기화 진행률 (0-100)
  sessionId?: string;
  fileId?: string;
  syncEventId?: string;
  error?: string;
  completedParts: number[];
  totalParts: number;
}

/**
 * 훅 반환 타입
 */
export interface UseMultipartUploadReturn {
  uploadFiles: UploadFile[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  startUpload: (token: string, folderId: string, conflictStrategy?: ConflictStrategy) => Promise<void>;
  cancelUpload: (id: string, token: string) => Promise<void>;
  cancelAll: (token: string) => Promise<void>;
  clearCompleted: () => void;
  isUploading: boolean;
}

/**
 * 멀티파트 업로드 최소 파일 크기 (100MB)
 */
const MULTIPART_MIN_SIZE = 100 * 1024 * 1024;

/**
 * 동기화 상태 폴링 간격 (ms)
 */
const SYNC_POLL_INTERVAL = 2000;

/**
 * 멀티파트 업로드 훅
 */
export function useMultipartUpload(): UseMultipartUploadReturn {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortControllers = useRef<Map<string, boolean>>(new Map());

  /**
   * 파일 추가
   */
  const addFiles = useCallback((files: File[]) => {
    const newFiles: UploadFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending' as UploadFileStatus,
      uploadProgress: 0,
      syncProgress: 0,
      completedParts: [],
      totalParts: 0,
    }));
    setUploadFiles((prev) => [...prev, ...newFiles]);
  }, []);

  /**
   * 파일 제거
   */
  const removeFile = useCallback((id: string) => {
    // 폴링 중지
    const interval = pollingIntervals.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.current.delete(id);
    }
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /**
   * 파일 상태 업데이트
   */
  const updateFileState = useCallback((id: string, update: Partial<UploadFile>) => {
    setUploadFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f))
    );
  }, []);

  /**
   * 동기화 상태 폴링 시작
   */
  const startSyncPolling = useCallback((
    id: string,
    syncEventId: string,
    token: string
  ) => {
    const poll = async () => {
      try {
        const status = await fileApi.getSyncEventStatus(token, syncEventId);
        
        updateFileState(id, {
          syncProgress: status.progress,
        });

        if (status.status === 'DONE') {
          updateFileState(id, { status: 'completed', syncProgress: 100 });
          const interval = pollingIntervals.current.get(id);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(id);
          }
        } else if (status.status === 'FAILED') {
          updateFileState(id, {
            status: 'error',
            error: status.errorMessage || 'NAS 동기화 실패',
          });
          const interval = pollingIntervals.current.get(id);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(id);
          }
        }
      } catch (error) {
        console.error('Sync polling error:', error);
      }
    };

    // 첫 번째 폴링 즉시 실행
    poll();

    // 주기적 폴링
    const interval = setInterval(poll, SYNC_POLL_INTERVAL);
    pollingIntervals.current.set(id, interval);
  }, [updateFileState]);

  /**
   * 단일 파일 업로드 (일반 업로드)
   */
  const uploadSmallFile = useCallback(async (
    uploadFile: UploadFile,
    token: string,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<void> => {
    updateFileState(uploadFile.id, { status: 'uploading' });

    try {
      const result = await fileApi.upload(token, uploadFile.file, folderId, conflictStrategy);
      
      updateFileState(uploadFile.id, {
        status: 'syncing',
        uploadProgress: 100,
        fileId: result.id,
        syncEventId: result.syncEventId,
      });

      // 동기화 상태 폴링 시작
      startSyncPolling(uploadFile.id, result.syncEventId, token);
    } catch (error) {
      updateFileState(uploadFile.id, {
        status: 'error',
        error: error instanceof Error ? error.message : '업로드 실패',
      });
      throw error;
    }
  }, [updateFileState, startSyncPolling]);

  /**
   * 단일 파일 멀티파트 업로드
   */
  const uploadLargeFile = useCallback(async (
    uploadFile: UploadFile,
    token: string,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<void> => {
    updateFileState(uploadFile.id, { status: 'uploading' });
    abortControllers.current.set(uploadFile.id, false);

    try {
      // 1. 세션 초기화
      const initResponse = await fileApi.multipartInitiate(token, {
        fileName: uploadFile.file.name,
        folderId,
        totalSize: uploadFile.file.size,
        mimeType: uploadFile.file.type || 'application/octet-stream',
        conflictStrategy,
      });

      updateFileState(uploadFile.id, {
        sessionId: initResponse.sessionId,
        totalParts: initResponse.totalParts,
      });

      // 2. 파트별 업로드
      const partSize = initResponse.partSize;
      const totalParts = initResponse.totalParts;
      let uploadedParts: number[] = [];
      let totalUploaded = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        // 취소 체크
        if (abortControllers.current.get(uploadFile.id)) {
          throw new Error('Upload cancelled');
        }

        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, uploadFile.file.size);
        const chunk = uploadFile.file.slice(start, end);
        const chunkBuffer = await chunk.arrayBuffer();

        await fileApi.multipartUploadPart(
          token,
          initResponse.sessionId,
          partNumber,
          chunkBuffer,
          (loaded, total) => {
            const currentProgress = totalUploaded + loaded;
            const overallProgress = Math.round((currentProgress / uploadFile.file.size) * 100);
            updateFileState(uploadFile.id, { uploadProgress: overallProgress });
          }
        );

        totalUploaded += chunkBuffer.byteLength;
        uploadedParts.push(partNumber);
        
        updateFileState(uploadFile.id, {
          completedParts: [...uploadedParts],
          uploadProgress: Math.round((totalUploaded / uploadFile.file.size) * 100),
        });
      }

      // 3. 업로드 완료
      const completeResponse = await fileApi.multipartComplete(token, initResponse.sessionId);
      
      updateFileState(uploadFile.id, {
        status: 'syncing',
        uploadProgress: 100,
        fileId: completeResponse.fileId,
        syncEventId: completeResponse.syncEventId,
      });

      // 4. 동기화 상태 폴링 시작
      startSyncPolling(uploadFile.id, completeResponse.syncEventId, token);
    } catch (error) {
      if (abortControllers.current.get(uploadFile.id)) {
        updateFileState(uploadFile.id, { status: 'cancelled' });
      } else {
        updateFileState(uploadFile.id, {
          status: 'error',
          error: error instanceof Error ? error.message : '업로드 실패',
        });
      }
      throw error;
    } finally {
      abortControllers.current.delete(uploadFile.id);
    }
  }, [updateFileState, startSyncPolling]);

  /**
   * 업로드 시작
   */
  const startUpload = useCallback(async (
    token: string,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<void> => {
    setIsUploading(true);

    const pendingFiles = uploadFiles.filter((f) => f.status === 'pending');
    
    for (const uploadFile of pendingFiles) {
      try {
        if (uploadFile.file.size >= MULTIPART_MIN_SIZE) {
          await uploadLargeFile(uploadFile, token, folderId, conflictStrategy);
        } else {
          await uploadSmallFile(uploadFile, token, folderId, conflictStrategy);
        }
      } catch (error) {
        console.error(`Failed to upload ${uploadFile.file.name}:`, error);
        // 에러가 발생해도 다음 파일 업로드 계속
      }
    }

    setIsUploading(false);
  }, [uploadFiles, uploadLargeFile, uploadSmallFile]);

  /**
   * 업로드 취소
   */
  const cancelUpload = useCallback(async (id: string, token: string): Promise<void> => {
    const uploadFile = uploadFiles.find((f) => f.id === id);
    if (!uploadFile) return;

    // 업로드 중인 경우 abort flag 설정
    if (uploadFile.status === 'uploading') {
      abortControllers.current.set(id, true);
    }

    // 세션이 있으면 서버에 취소 요청
    if (uploadFile.sessionId) {
      try {
        await fileApi.multipartAbort(token, uploadFile.sessionId);
      } catch (error) {
        console.error('Failed to abort upload:', error);
      }
    }

    // 폴링 중지
    const interval = pollingIntervals.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.current.delete(id);
    }

    updateFileState(id, { status: 'cancelled' });
  }, [uploadFiles, updateFileState]);

  /**
   * 모든 업로드 취소
   */
  const cancelAll = useCallback(async (token: string): Promise<void> => {
    for (const uploadFile of uploadFiles) {
      if (uploadFile.status === 'pending' || uploadFile.status === 'uploading') {
        await cancelUpload(uploadFile.id, token);
      }
    }
  }, [uploadFiles, cancelUpload]);

  /**
   * 완료된 파일 정리
   */
  const clearCompleted = useCallback(() => {
    setUploadFiles((prev) =>
      prev.filter((f) => f.status !== 'completed' && f.status !== 'error' && f.status !== 'cancelled')
    );
  }, []);

  return {
    uploadFiles,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
    cancelAll,
    clearCompleted,
    isUploading,
  };
}

export default useMultipartUpload;
