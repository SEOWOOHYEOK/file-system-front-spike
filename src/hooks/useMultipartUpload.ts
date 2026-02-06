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
  | 'queued'       // 서버 대기열 대기 중 (슬롯 부족)
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
  /** 대기열 티켓 (queued 상태에서 사용) */
  queueTicket?: string;
  /** 대기열 현재 순번 */
  queuePosition?: number;
  /** 대기열 예상 대기 시간 (초) */
  estimatedWaitSeconds?: number;
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
 * 대기열 폴링 간격 (ms) - 5초
 */
const QUEUE_POLL_INTERVAL = 5000;

/**
 * 대기열 최대 폴링 횟수 (30분 / 5초 = 360회)
 */
const QUEUE_MAX_ATTEMPTS = 360;

/**
 * localStorage 캐시 (js-cache-storage 규칙)
 * localStorage I/O는 동기적이고 비용이 크므로 메모리에 캐싱
 */
let sessionsCache: StoredUploadSession[] | null = null;

/**
 * localStorage에서 저장된 세션 목록 가져오기 (캐시 사용)
 */
const getStoredSessions = (): StoredUploadSession[] => {
  if (sessionsCache !== null) {
    return sessionsCache;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: StoredUploadSession[] = stored ? JSON.parse(stored) : [];
    sessionsCache = parsed;
    return parsed;
  } catch {
    const empty: StoredUploadSession[] = [];
    sessionsCache = empty;
    return empty;
  }
};

/**
 * localStorage에 세션 저장 (캐시 동기화)
 */
const saveSession = (session: StoredUploadSession): void => {
  try {
    const sessions = [...getStoredSessions()];
    const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    sessionsCache = sessions;
  } catch (error) {
    console.error('Failed to save session to localStorage:', error);
  }
};

/**
 * localStorage에서 세션 삭제 (캐시 동기화)
 */
const removeStoredSession = (sessionId: string): void => {
  try {
    const sessions = getStoredSessions();
    const filtered = sessions.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    sessionsCache = filtered;
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
   * 진행률 전용 ref (rerender-use-ref-transient-values 패턴)
   * - onUploadProgress 콜백은 초당 수십~수백회 호출됨
   * - 매번 setState하면 React 리렌더 폭주 → UI 3초 멈춤
   * - ref에 저장하고 rAF로 ~60fps에만 실제 상태 반영
   */
  const progressRef = useRef<Map<string, { uploadProgress: number; completedParts: number[] }>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  /**
   * rAF 기반 진행률 동기화 (화면 갱신 주기에만 setState)
   */
  const scheduleProgressFlush = useCallback(() => {
    if (rafIdRef.current !== null) return; // 이미 예약됨
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const updates = progressRef.current;
      if (updates.size === 0) return;

      setUploadFiles((prev) =>
        prev.map((f) => {
          const update = updates.get(f.id);
          if (!update) return f;
          return { ...f, ...update };
        })
      );
    });
  }, []);

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
    progressRef.current.delete(id);
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /**
   * 파일 상태 업데이트 (즉시 반영 - 상태 변경, 완료, 에러 등)
   */
  const updateFileState = useCallback((id: string, update: Partial<UploadFile>) => {
    setUploadFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f))
    );
  }, []);

  /**
   * 진행률만 업데이트 (rAF 스로틀 - 고빈도 호출용)
   */
  const updateProgress = useCallback((id: string, uploadProgress: number, completedParts?: number[]) => {
    const current = progressRef.current.get(id);
    progressRef.current.set(id, {
      uploadProgress,
      completedParts: completedParts ?? current?.completedParts ?? [],
    });
    scheduleProgressFlush();
  }, [scheduleProgressFlush]);

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
   * 대기열 폴링 (READY 될 때까지)
   * initiate에서 202(WAITING)를 받은 경우, 서버가 슬롯을 확보할 때까지 폴링합니다.
   * READY가 되면 sessionId 등의 세션 정보를 반환합니다.
   */
  const pollQueueUntilReady = useCallback(async (
    fileId: string,
    ticket: string,
    token: string
  ): Promise<{ sessionId: string; partSize: number; totalParts: number; expiresAt: string }> => {
    for (let i = 0; i < QUEUE_MAX_ATTEMPTS; i++) {
      // 취소 체크
      if (abortControllers.current.get(fileId)) {
        try {
          await fileApi.queueCancel(token, ticket);
        } catch { /* 무시 */ }
        throw new Error('Upload cancelled');
      }

      const response = await fileApi.queuePoll(token, ticket);

      switch (response.status) {
        case 'WAITING':
          updateFileState(fileId, {
            queuePosition: response.position,
            estimatedWaitSeconds: response.estimatedWaitSeconds,
          });
          await new Promise((r) => setTimeout(r, QUEUE_POLL_INTERVAL));
          break;

        case 'READY':
          return {
            sessionId: response.sessionId,
            partSize: response.partSize,
            totalParts: response.totalParts,
            expiresAt: response.expiresAt,
          };

        case 'EXPIRED':
          throw new Error('대기열 티켓이 만료되었습니다. 다시 시도해주세요.');

        case 'CANCELLED':
          throw new Error('대기열이 취소되었습니다.');

        default:
          throw new Error(`알 수 없는 대기열 상태: ${(response as { status: string }).status}`);
      }
    }

    throw new Error('대기 시간이 초과되었습니다. (30분)');
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
        // 새 업로드: 세션 초기화 (Admission Control)
        const initResponse = await fileApi.multipartInitiate(token, {
          fileName: uploadFile.file.name,
          folderId,
          totalSize: uploadFile.file.size,
          mimeType: uploadFile.file.type || 'application/octet-stream',
          conflictStrategy,
        });

        let expiresAt: string;

        if (initResponse.status === 'ACTIVE') {
          // ✅ 슬롯 확보 → 즉시 파트 업로드 시작
          sessionId = initResponse.sessionId;
          partSize = initResponse.partSize;
          totalParts = initResponse.totalParts;
          expiresAt = initResponse.expiresAt;
        } else if (initResponse.status === 'WAITING') {
          // ⏳ 슬롯 부족 → 대기열 등록, 폴링 시작
          updateFileState(uploadFile.id, {
            status: 'queued',
            queueTicket: initResponse.queueTicket,
            queuePosition: initResponse.position,
            estimatedWaitSeconds: initResponse.estimatedWaitSeconds,
          });

          // 대기열 폴링 (READY가 될 때까지 대기)
          const readyInfo = await pollQueueUntilReady(
            uploadFile.id,
            initResponse.queueTicket,
            token
          );

          sessionId = readyInfo.sessionId;
          partSize = readyInfo.partSize;
          totalParts = readyInfo.totalParts;
          expiresAt = readyInfo.expiresAt;

          // 대기열 완료 → 업로드 상태로 전환 (대기열 필드 초기화)
          updateFileState(uploadFile.id, {
            status: 'uploading',
            queueTicket: undefined,
            queuePosition: undefined,
            estimatedWaitSeconds: undefined,
          });
        } else {
          throw new Error(`initiate 실패: 알 수 없는 응답`);
        }

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
          expiresAt,
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
        const chunkSize = end - start;
        // Blob.slice()로 파일 참조만 생성 (메모리 복사 없음)
        const chunk = uploadFile.file.slice(start, end);

        await fileApi.multipartUploadPart(
          token,
          sessionId,
          partNumber,
          chunk,  // Blob 직접 전송 - ArrayBuffer 변환 불필요
          (loaded, _total) => {
            // rAF 스로틀: 초당 수백 회 → ~60fps로 제한
            const currentProgress = totalUploaded + loaded;
            const overallProgress = Math.round((currentProgress / uploadFile.file.size) * 100);
            updateProgress(uploadFile.id, overallProgress);
          }
        );

        totalUploaded += chunkSize;
        uploadedParts.push(partNumber);

        const currentProgress = Math.round((totalUploaded / uploadFile.file.size) * 100);

        // 진행률은 rAF로 스로틀 (리렌더 최소화)
        updateProgress(uploadFile.id, currentProgress, [...uploadedParts]);

        // localStorage 업데이트 (매 10파트마다 또는 마지막 파트)
        if (partNumber % 10 === 0 || partNumber === totalParts) {
          saveSession({
            id: uploadFile.id,
            sessionId,
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            folderId,
            partSize,
            totalParts,
            completedParts: uploadedParts,
            uploadProgress: currentProgress,
            createdAt: new Date().toISOString(),
            expiresAt: '',
          });
        }
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
      progressRef.current.delete(uploadFile.id);
    }
  }, [updateFileState, updateProgress, startSyncPolling, pollQueueUntilReady]);

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
          }, 1000);
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

    // 대기열 대기 중인 경우: 대기열 취소 + abort flag 설정 (폴링 루프 탈출)
    if (uploadFile.status === 'queued' && uploadFile.queueTicket) {
      abortControllers.current.set(id, true);
      try {
        await fileApi.queueCancel(token, uploadFile.queueTicket);
      } catch (error) {
        console.error('Failed to cancel queue ticket:', error);
      }
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

    updateFileState(id, {
      status: 'cancelled',
      queueTicket: undefined,
      queuePosition: undefined,
      estimatedWaitSeconds: undefined,
    });
  }, [uploadFiles, updateFileState]);

  /**
   * 모든 업로드 취소
   * Promise.all()로 병렬 실행하여 성능 개선 (async-parallel 규칙)
   */
  const cancelAll = useCallback(async (token: string): Promise<void> => {
    const filesToCancel = uploadFiles.filter(
      (f) => f.status === 'pending' || f.status === 'queued' || f.status === 'uploading' || f.status === 'paused'
    );
    await Promise.all(filesToCancel.map((f) => cancelUpload(f.id, token)));
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
   * Promise.all()로 병렬 실행하여 성능 개선 (async-parallel 규칙)
   */
  const loadPendingSessions = useCallback(async (token: string): Promise<void> => {
    const storedSessions = getStoredSessions();

    if (storedSessions.length === 0) return;

    // 병렬로 모든 세션 상태 확인
    const results = await Promise.all(
      storedSessions.map(async (session) => {
        try {
          const status = await fileApi.multipartStatus(token, session.sessionId);

          if (status.status === 'INIT' || status.status === 'UPLOADING') {
            return {
              type: 'valid' as const,
              session: {
                id: session.id,
                file: null as unknown as File,
                status: 'paused' as UploadFileStatus,
                uploadProgress: status.progress,
                syncProgress: 0,
                sessionId: session.sessionId,
                completedParts: status.completedParts,
                totalParts: status.totalParts,
                partSize: session.partSize,
                folderId: session.folderId,
              },
            };
          } else {
            // COMPLETED, EXPIRED, ABORTED - localStorage에서 삭제
            removeStoredSession(session.sessionId);
            return { type: 'invalid' as const };
          }
        } catch (error) {
          console.error(`Failed to check session ${session.sessionId}:`, error);
          removeStoredSession(session.sessionId);
          return { type: 'invalid' as const };
        }
      })
    );

    // 유효한 세션만 필터링
    const validSessions: UploadFile[] = results
      .filter((r) => r.type === 'valid')
      .map((r) => (r as { type: 'valid'; session: UploadFile }).session);

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
