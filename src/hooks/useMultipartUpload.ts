/**
 * 멀티파트 업로드 훅
 * 대용량 파일을 청크 단위로 업로드하고 진행률을 추적합니다.
 * 이어서 업로드(Resume) 기능을 지원합니다.
 */
import { useState, useCallback, useRef } from 'react';
import { fileApi } from '../api/fileApi';
import type {
  ConflictStrategy,
  SyncProgressInfo,
  SyncProgressStatus,
} from '../types/file.types';

/**
 * 업로드 파일 상태
 */
export type UploadFileStatus =
  | 'pending'      // 대기 중
  | 'uploading'    // 업로드 중
  | 'paused'       // 일시정지
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
  /** 동기화 상세 진행률 정보 */
  syncProgressInfo?: SyncProgressInfo;
  /** 동기화 상태 (상세) */
  syncStatus?: SyncProgressStatus;
  /** 동기화 상태 메시지 */
  syncMessage?: string;
  sessionId?: string;
  fileId?: string;
  syncEventId?: string;
  error?: string;
  completedParts: number[];
  totalParts: number;
  partSize?: number;       // 파트 크기 (이어서 업로드용)
  folderId?: string;       // 폴더 ID (이어서 업로드용)
}

/**
 * localStorage에 저장할 세션 정보
 */
export interface StoredUploadSession {
  id: string;
  sessionId: string;
  fileName: string;
  fileSize: number;
  folderId: string;
  partSize: number;
  totalParts: number;
  completedParts: number[];
  uploadProgress: number;
  createdAt: string;
  expiresAt: string;
}

const STORAGE_KEY = 'multipart_upload_sessions';

/**
 * 훅 반환 타입
 */
export interface UseMultipartUploadReturn {
  uploadFiles: UploadFile[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  startUpload: (token: string, folderId: string, conflictStrategy?: ConflictStrategy) => Promise<void>;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string, token: string, file?: File) => Promise<void>;
  cancelUpload: (id: string, token: string) => Promise<void>;
  cancelAll: (token: string) => Promise<void>;
  clearCompleted: () => void;
  loadPendingSessions: (token: string) => Promise<void>;
  getPendingSessions: () => StoredUploadSession[];
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
 * localStorage에서 저장된 세션 목록 가져오기
 */
const getStoredSessions = (): StoredUploadSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * localStorage에 세션 저장
 */
const saveSession = (session: StoredUploadSession): void => {
  try {
    const sessions = getStoredSessions();
    const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save session to localStorage:', error);
  }
};

/**
 * localStorage에서 세션 삭제
 */
const removeStoredSession = (sessionId: string): void => {
  try {
    const sessions = getStoredSessions();
    const filtered = sessions.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove session from localStorage:', error);
  }
};

/**
 * 멀티파트 업로드 훅
 */
export function useMultipartUpload(): UseMultipartUploadReturn {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const pollingIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const abortControllers = useRef<Map<string, boolean>>(new Map());
  const pauseFlags = useRef<Map<string, boolean>>(new Map());

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
   * 동기화 상태 폴링 시작 (상세 진행률)
   */
  const startSyncPolling = useCallback((
    id: string,
    syncEventId: string,
    token: string
  ) => {
    const poll = async () => {
      try {
        // 상세 진행률 API 사용
        const response = await fileApi.getSyncProgress(token, syncEventId);


        // 진행률 정보
        const syncProgress = response.progress?.percent ?? 0;

        console.log('--------------------------------');
        console.log('syncEventId', syncEventId);
        console.log('response progress', response.progress);
        console.log('response status', response.status);
        console.log('response syncEventId', response.syncEventId);
        console.log('response eventType', response.eventType);
        console.log('--------------------------------');

        // 상태별 처리 (한 번의 updateFileState 호출로 통합)
        if (response.status === 'QUEUED') {
          // 대기 중 - 계속 폴링 (syncing 상태 유지)
          updateFileState(id, {
            status: 'syncing',
            syncProgress: 0,
            syncProgressInfo: response.progress,
            syncStatus: 'QUEUED',
            syncMessage: '동기화 대기 중...',
          });
        } else if (response.status === 'PROCESSING') {
          // 처리 중 - 상세 진행률 표시 (syncing 상태 유지)
          const progressMessage = response.progress?.completedChunks !== undefined && response.progress?.totalChunks !== undefined
            ? `동기화 중... (${response.progress.completedChunks}/${response.progress.totalChunks} 청크)`
            : `동기화 중... (${syncProgress}%)`;

          updateFileState(id, {
            status: 'syncing',
            syncProgress,
            syncProgressInfo: response.progress,
            syncStatus: 'PROCESSING',
            syncMessage: progressMessage,
          });
        } else if (response.status === 'DONE') {
          updateFileState(id, {
            status: 'completed',
            syncProgress: 100,
            syncStatus: 'DONE',
          });
          const interval = pollingIntervals.current.get(id);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(id);
          }
        } else if (response.status === 'FAILED') {
          updateFileState(id, {
            status: 'error',
            error: response.errorMessage || 'NAS 동기화 실패',
            syncStatus: 'FAILED',
          });
          const interval = pollingIntervals.current.get(id);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(id);
          }
        } else if (response.status === 'IDLE') {
          updateFileState(id, {
            status: 'syncing',
            syncProgress: 0,
            syncProgressInfo: response.progress,
            syncStatus: 'QUEUED',
            syncMessage: '동기화 대기 중...',
          });
          
        }
      } catch (error) {
        console.error('Sync polling error:', error);
        // 에러 발생 시 기존 API로 폴백
        try {
          const status = await fileApi.getSyncEventStatus(token, syncEventId);
          updateFileState(id, { syncProgress: status.progress });

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
        } catch (fallbackError) {
          console.error('Sync polling fallback error:', fallbackError);
        }
      }
    };

    // 첫 번째 폴링 즉시 실행
    poll();

    // 주기적 폴링
    const interval = setInterval(poll, SYNC_POLL_INTERVAL);
    pollingIntervals.current.set(id, interval);
  }, [updateFileState]);

  /**
   * 단일 파일 멀티파트 업로드
   * @param resumeFrom 이어서 업로드할 경우 세션 정보
   */
  const uploadLargeFile = useCallback(async (
    uploadFile: UploadFile,
    token: string,
    folderId: string,
    conflictStrategy?: ConflictStrategy,
    resumeFrom?: { sessionId: string; partSize: number; totalParts: number; completedParts: number[] }
  ): Promise<void> => {
    updateFileState(uploadFile.id, { status: 'uploading', folderId });
    abortControllers.current.set(uploadFile.id, false);
    pauseFlags.current.set(uploadFile.id, false);

    let sessionId: string;
    let partSize: number;
    let totalParts: number;
    let uploadedParts: number[];
    let totalUploaded: number;

    try {
      if (resumeFrom) {
        // 이어서 업로드: 기존 세션 정보 사용
        sessionId = resumeFrom.sessionId;
        partSize = resumeFrom.partSize;
        totalParts = resumeFrom.totalParts;
        uploadedParts = [...resumeFrom.completedParts];
        totalUploaded = uploadedParts.length * partSize;

        // 마지막 파트가 부분적일 수 있으므로 정확한 업로드 바이트 계산
        if (uploadedParts.length > 0) {
          const lastCompletedPart = Math.max(...uploadedParts);
          if (lastCompletedPart === totalParts) {
            // 마지막 파트가 완료된 경우, 파일 크기에서 남은 바이트 계산
            totalUploaded = uploadFile.file.size;
          } else {
            totalUploaded = uploadedParts.reduce((sum, partNum) => {
              if (partNum === totalParts) {
                return sum + (uploadFile.file.size - (totalParts - 1) * partSize);
              }
              return sum + partSize;
            }, 0);
          }
        }

        updateFileState(uploadFile.id, {
          sessionId,
          totalParts,
          partSize,
          completedParts: uploadedParts,
          uploadProgress: Math.round((totalUploaded / uploadFile.file.size) * 100),
        });
      } else {
        // 새 업로드: 세션 초기화
        const initResponse = await fileApi.multipartInitiate(token, {
          fileName: uploadFile.file.name,
          folderId,
          totalSize: uploadFile.file.size,
          mimeType: uploadFile.file.type || 'application/octet-stream',
          conflictStrategy,
        });

        sessionId = initResponse.sessionId;
        partSize = initResponse.partSize;
        totalParts = initResponse.totalParts;
        uploadedParts = [];
        totalUploaded = 0;

        updateFileState(uploadFile.id, {
          sessionId,
          totalParts,
          partSize,
        });

        // localStorage에 세션 저장
        saveSession({
          id: uploadFile.id,
          sessionId,
          fileName: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          folderId,
          partSize,
          totalParts,
          completedParts: [],
          uploadProgress: 0,
          createdAt: new Date().toISOString(),
          expiresAt: initResponse.expiresAt,
        });
      }

      // 파트별 업로드
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        // 이미 완료된 파트는 건너뛰기
        if (uploadedParts.includes(partNumber)) {
          continue;
        }

        // 취소 체크
        if (abortControllers.current.get(uploadFile.id)) {
          throw new Error('Upload cancelled');
        }

        // 일시정지 체크
        if (pauseFlags.current.get(uploadFile.id)) {
          // 일시정지 상태로 변경하고 현재 진행 상황 저장
          updateFileState(uploadFile.id, {
            status: 'paused',
            completedParts: [...uploadedParts],
          });

          // localStorage 업데이트
          saveSession({
            id: uploadFile.id,
            sessionId,
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            folderId,
            partSize,
            totalParts,
            completedParts: uploadedParts,
            uploadProgress: Math.round((totalUploaded / uploadFile.file.size) * 100),
            createdAt: new Date().toISOString(),
            expiresAt: '', // 서버에서 가져와야 함
          });

          return; // 업로드 중단 (에러 throw 안 함)
        }

        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, uploadFile.file.size);
        const chunk = uploadFile.file.slice(start, end);
        const chunkBuffer = await chunk.arrayBuffer();

        await fileApi.multipartUploadPart(
          token,
          sessionId,
          partNumber,
          chunkBuffer,
          (loaded, _total) => {
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

        // localStorage 업데이트 (진행 상황 저장)
        saveSession({
          id: uploadFile.id,
          sessionId,
          fileName: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          folderId,
          partSize,
          totalParts,
          completedParts: uploadedParts,
          uploadProgress: Math.round((totalUploaded / uploadFile.file.size) * 100),
          createdAt: new Date().toISOString(),
          expiresAt: '',
        });
      }

      // 업로드 완료
      const completeResponse = await fileApi.multipartComplete(token, sessionId);

      // localStorage에서 세션 삭제
      removeStoredSession(sessionId);

      updateFileState(uploadFile.id, {
        status: 'syncing',
        uploadProgress: 100,
        fileId: completeResponse.fileId,
        syncEventId: completeResponse.syncEventId,
        syncMessage: '동기화 준비 중...',
      });

      // 동기화 상태 폴링 시작 (서버 준비 시간 1.5초 대기)
      setTimeout(() => {
        startSyncPolling(uploadFile.id, completeResponse.syncEventId, token);
      }, 1500);
    } catch (error) {
      if (abortControllers.current.get(uploadFile.id)) {
        updateFileState(uploadFile.id, { status: 'cancelled' });
        // 취소된 경우 localStorage에서도 삭제
        if (uploadFile.sessionId) {
          removeStoredSession(uploadFile.sessionId);
        }
      } else if (!pauseFlags.current.get(uploadFile.id)) {
        updateFileState(uploadFile.id, {
          status: 'error',
          error: error instanceof Error ? error.message : '업로드 실패',
        });
      }
      throw error;
    } finally {
      abortControllers.current.delete(uploadFile.id);
      pauseFlags.current.delete(uploadFile.id);
    }
  }, [updateFileState, startSyncPolling]);

  /**
   * 다중 소용량 파일 업로드 (uploadMany API 사용)
   */
  const uploadSmallFilesInBatch = useCallback(async (
    files: UploadFile[],
    token: string,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<void> => {
    if (files.length === 0) return;

    // 모든 파일 상태를 uploading으로 변경
    files.forEach((f) => {
      updateFileState(f.id, { status: 'uploading', folderId });
    });

    try {
      // uploadMany API 호출
      const results = await fileApi.uploadMany(
        token,
        files.map((f) => f.file),
        folderId,
        conflictStrategy
      );

      // 결과 처리 - 각 파일의 동기화 상태 폴링 시작
      results.forEach((result, index) => {
        const uploadFile = files[index];
        if (uploadFile) {
          updateFileState(uploadFile.id, {
            status: 'syncing',
            uploadProgress: 100,
            fileId: result.id,
            syncEventId: result.syncEventId,
            syncMessage: '동기화 준비 중...',
          });
          // 동기화 상태 폴링 시작 (서버 준비 시간 0.3초 대기)
          setTimeout(() => {
            startSyncPolling(uploadFile.id, result.syncEventId, token);
          }, 300);
        }
      });
    } catch (error) {
      // 에러 시 모든 파일 상태를 error로 변경
      files.forEach((f) => {
        updateFileState(f.id, {
          status: 'error',
          error: error instanceof Error ? error.message : '업로드 실패',
        });
      });
      throw error;
    }
  }, [updateFileState, startSyncPolling]);

  /**
   * 업로드 시작 (병렬 처리)
   */
  const startUpload = useCallback(async (
    token: string,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<void> => {
    setIsUploading(true);

    // pending 상태의 파일만 업로드 시작
    const pendingFiles = uploadFiles.filter((f) => f.status === 'pending');

    // 파일 크기별로 분류
    const smallFiles = pendingFiles.filter((f) => f.file.size < MULTIPART_MIN_SIZE);
    const largeFiles = pendingFiles.filter((f) => f.file.size >= MULTIPART_MIN_SIZE);

    // folderId 저장
    pendingFiles.forEach((f) => {
      updateFileState(f.id, { folderId });
    });

    try {
      // 병렬로 업로드 실행
      await Promise.all([
        // 소용량 파일들은 uploadMany로 한번에 업로드
        smallFiles.length > 0
          ? uploadSmallFilesInBatch(smallFiles, token, folderId, conflictStrategy)
          : Promise.resolve(),
        // 대용량 파일들은 각각 병렬로 멀티파트 업로드
        ...largeFiles.map((uploadFile) =>
          uploadLargeFile(uploadFile, token, folderId, conflictStrategy).catch((error) => {
            console.error(`Failed to upload ${uploadFile.file.name}:`, error);
            // 개별 파일 에러는 무시하고 계속 진행
          })
        ),
      ]);
    } catch (error) {
      console.error('Upload batch failed:', error);
    }

    setIsUploading(false);
  }, [uploadFiles, uploadLargeFile, uploadSmallFilesInBatch, updateFileState]);

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

    // 세션이 있으면 서버에 취소 요청 및 localStorage 정리
    if (uploadFile.sessionId) {
      try {
        await fileApi.multipartAbort(token, uploadFile.sessionId);
      } catch (error) {
        console.error('Failed to abort upload:', error);
      }
      // localStorage에서 세션 삭제
      removeStoredSession(uploadFile.sessionId);
    }

    // 폴링 중지
    const interval = pollingIntervals.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.current.delete(id);
    }

    // 일시정지 플래그 정리
    pauseFlags.current.delete(id);

    updateFileState(id, { status: 'cancelled' });
  }, [uploadFiles, updateFileState]);

  /**
   * 모든 업로드 취소
   */
  const cancelAll = useCallback(async (token: string): Promise<void> => {
    for (const uploadFile of uploadFiles) {
      if (uploadFile.status === 'pending' || uploadFile.status === 'uploading' || uploadFile.status === 'paused') {
        await cancelUpload(uploadFile.id, token);
      }
    }
  }, [uploadFiles, cancelUpload]);

  /**
   * 업로드 일시정지
   */
  const pauseUpload = useCallback((id: string): void => {
    const uploadFile = uploadFiles.find((f) => f.id === id);
    if (!uploadFile || uploadFile.status !== 'uploading') return;

    pauseFlags.current.set(id, true);
  }, [uploadFiles]);

  /**
   * 이어서 업로드
   * @param id 업로드 파일 ID
   * @param token 인증 토큰
   * @param file 파일 객체 (새로고침 후에는 파일을 다시 선택해야 함)
   */
  const resumeUpload = useCallback(async (
    id: string,
    token: string,
    file?: File
  ): Promise<void> => {
    const uploadFile = uploadFiles.find((f) => f.id === id);

    if (!uploadFile) {
      console.error('Upload file not found:', id);
      return;
    }

    if (uploadFile.status !== 'paused' && uploadFile.status !== 'error') {
      console.error('Can only resume paused or errored uploads');
      return;
    }

    if (!uploadFile.sessionId) {
      console.error('No session ID found for resuming');
      return;
    }

    // 파일 객체가 없으면 (페이지 새로고침 후) file 파라미터 필요
    const fileToUpload = file || uploadFile.file;
    if (!fileToUpload) {
      console.error('File object required for resuming');
      return;
    }

    setIsUploading(true);

    try {
      // 서버에서 현재 세션 상태 조회
      const sessionStatus = await fileApi.multipartStatus(token, uploadFile.sessionId);

      if (sessionStatus.status === 'COMPLETED') {
        // 이미 완료된 경우
        updateFileState(id, { status: 'completed', uploadProgress: 100 });
        removeStoredSession(uploadFile.sessionId);
        return;
      }

      if (sessionStatus.status === 'ABORTED' || sessionStatus.status === 'EXPIRED') {
        // 세션이 만료되거나 취소된 경우 - 새로 시작해야 함
        updateFileState(id, {
          status: 'error',
          error: `세션이 ${sessionStatus.status === 'EXPIRED' ? '만료' : '취소'}되었습니다. 다시 업로드해주세요.`
        });
        removeStoredSession(uploadFile.sessionId);
        return;
      }

      // 파일 객체를 업데이트하고 이어서 업로드
      const updatedFile: UploadFile = {
        ...uploadFile,
        file: fileToUpload,
      };

      // 세션 상태에서 가져온 정보로 이어서 업로드
      await uploadLargeFile(
        updatedFile,
        token,
        uploadFile.folderId || '',
        undefined,
        {
          sessionId: sessionStatus.sessionId,
          partSize: Math.ceil(sessionStatus.totalSize / sessionStatus.totalParts),
          totalParts: sessionStatus.totalParts,
          completedParts: sessionStatus.completedParts,
        }
      );
    } catch (error) {
      console.error('Failed to resume upload:', error);
      updateFileState(id, {
        status: 'error',
        error: error instanceof Error ? error.message : '이어서 업로드 실패',
      });
    } finally {
      setIsUploading(false);
    }
  }, [uploadFiles, updateFileState, uploadLargeFile]);

  /**
   * localStorage에서 저장된 미완료 세션 목록 가져오기
   */
  const getPendingSessions = useCallback((): StoredUploadSession[] => {
    return getStoredSessions();
  }, []);

  /**
   * localStorage에서 미완료 세션 불러오기 및 상태 복원
   * 서버에서 세션 유효성 확인 후 uploadFiles에 추가
   */
  const loadPendingSessions = useCallback(async (token: string): Promise<void> => {
    const storedSessions = getStoredSessions();

    if (storedSessions.length === 0) return;

    const validSessions: UploadFile[] = [];

    for (const session of storedSessions) {
      try {
        // 서버에서 세션 상태 확인
        const status = await fileApi.multipartStatus(token, session.sessionId);

        if (status.status === 'INIT' || status.status === 'UPLOADING') {
          // 유효한 세션 - uploadFiles에 추가 (paused 상태로)
          validSessions.push({
            id: session.id,
            file: null as unknown as File, // 파일은 사용자가 다시 선택해야 함
            status: 'paused',
            uploadProgress: status.progress,
            syncProgress: 0,
            sessionId: session.sessionId,
            completedParts: status.completedParts,
            totalParts: status.totalParts,
            partSize: session.partSize,
            folderId: session.folderId,
          });
        } else if (status.status === 'COMPLETED') {
          // 이미 완료됨 - localStorage에서 삭제
          removeStoredSession(session.sessionId);
        } else {
          // 만료 또는 취소됨 - localStorage에서 삭제
          removeStoredSession(session.sessionId);
        }
      } catch (error) {
        // 세션 조회 실패 - localStorage에서 삭제
        console.error(`Failed to check session ${session.sessionId}:`, error);
        removeStoredSession(session.sessionId);
      }
    }

    if (validSessions.length > 0) {
      setUploadFiles((prev) => [...prev, ...validSessions]);
    }
  }, []);

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
    pauseUpload,
    resumeUpload,
    cancelUpload,
    cancelAll,
    clearCompleted,
    loadPendingSessions,
    getPendingSessions,
    isUploading,
  };
}

export default useMultipartUpload;
