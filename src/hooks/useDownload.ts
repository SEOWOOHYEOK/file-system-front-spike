/**
 * 다운로드 훅
 * 파일 다운로드 상태 관리, 이어받기, 병렬 다운로드, 체크섬 검증 기능
 */
import { useState, useCallback, useRef } from 'react';
import { fileApi } from '../api/fileApi';
import { verifyChecksum } from '../utils/checksum';
import type {
  DownloadFile,
  DownloadFileStatus,
  StoredDownloadSession,
} from '../types/file.types';

/**
 * 병렬 다운로드 최소 파일 크기 (100MB)
 */
const PARALLEL_MIN_SIZE = 100 * 1024 * 1024;

/**
 * localStorage 키
 */
const STORAGE_KEY = 'download_sessions';

/**
 * localStorage에서 저장된 세션 목록 가져오기
 */
const getStoredSessions = (): StoredDownloadSession[] => {
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
const saveSession = (session: StoredDownloadSession): void => {
  try {
    const sessions = getStoredSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save download session:', error);
  }
};

/**
 * localStorage에서 세션 삭제
 */
const removeStoredSession = (id: string): void => {
  try {
    const sessions = getStoredSessions();
    const filtered = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove download session:', error);
  }
};

/**
 * 파일 저장 (브라우저 다운로드 트리거)
 */
const saveFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 훅 반환 타입
 */
export interface UseDownloadReturn {
  downloadFiles: DownloadFile[];
  startDownload: (token: string, fileId: string, fileName: string, fileSize: number) => Promise<void>;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string, token: string) => Promise<void>;
  cancelDownload: (id: string) => void;
  clearCompleted: () => void;
  isDownloading: boolean;
}

/**
 * 다운로드 훅
 */
export function useDownload(): UseDownloadReturn {
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const pauseFlags = useRef<Map<string, boolean>>(new Map());

  /**
   * 다운로드 파일 상태 업데이트
   */
  const updateFileState = useCallback((id: string, update: Partial<DownloadFile>) => {
    setDownloadFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f))
    );
  }, []);

  // 진행 중인 다운로드 fileId 추적 (중복 방지)
  const activeDownloads = useRef<Set<string>>(new Set());

  /**
   * 다운로드 시작
   */
  const startDownload = useCallback(async (
    token: string,
    fileId: string,
    fileName: string,
    fileSize: number
  ): Promise<void> => {
    // 이미 다운로드 중인 파일인지 확인 (중복 방지)
    if (activeDownloads.current.has(fileId)) {
      console.warn(`Download already in progress for file: ${fileId}`);
      return;
    }
    activeDownloads.current.add(fileId);

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const useParallel = fileSize >= PARALLEL_MIN_SIZE;

    // 새 다운로드 파일 추가
    const newDownload: DownloadFile = {
      id,
      fileId,
      fileName,
      fileSize,
      status: 'downloading',
      progress: 0,
      downloadedSize: 0,
      useParallel,
    };

    setDownloadFiles((prev) => [...prev, newDownload]);
    setIsDownloading(true);

    // AbortController 설정
    const controller = new AbortController();
    abortControllers.current.set(id, controller);
    pauseFlags.current.set(id, false);

    try {
      let blob: Blob;
      let etag: string | undefined;
      let downloadChecksum: string | undefined;

      // 1. 다운로드 실행
      if (useParallel) {
        // 병렬 다운로드
        const result = await fileApi.parallelDownload(token, fileId, fileSize, {
          onProgress: (percent, downloaded, total) => {
            if (pauseFlags.current.get(id)) return;
            updateFileState(id, {
              progress: percent,
              downloadedSize: downloaded,
            });
          },
        });
        blob = result.blob;
        etag = result.etag;
        downloadChecksum = result.checksum; // 206 응답에서는 보통 없음
      } else {
        // 일반 다운로드 (진행률 추적)
        const result = await fileApi.downloadWithProgress(
          token,
          fileId,
          (percent, downloaded, total) => {
            if (pauseFlags.current.get(id)) return;
            updateFileState(id, {
              progress: percent,
              downloadedSize: downloaded,
            });
          }
        );
        blob = result.blob;
        etag = result.etag;
        downloadChecksum = result.checksum; // 200 응답에서는 헤더에 있을 수 있음
      }

      // 2. 일시정지 체크
      if (pauseFlags.current.get(id)) {
        updateFileState(id, {
          status: 'paused',
          etag,
        });
        // localStorage에 세션 저장
        saveSession({
          id,
          fileId,
          fileName,
          fileSize,
          downloadedSize: downloadFiles.find(f => f.id === id)?.downloadedSize || 0,
          etag: etag || '',
          useParallel,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      // 3. 크기 검증 (size === blob.size)
      console.log('[Download] Size verification:', { expected: fileSize, actual: blob.size });
      if (blob.size !== fileSize) {
        console.error(`[Download] Size mismatch: expected ${fileSize}, got ${blob.size}`);
        updateFileState(id, {
          status: 'error',
          error: `파일 크기 불일치: 예상 ${fileSize} bytes, 실제 ${blob.size} bytes`,
          checksumVerified: false,
        });
        return;
      }

      // 4. 체크섬 획득 (다운로드 완료 후 조회 - 효율적)
      // 다운로드 응답 헤더에 체크섬이 있으면 사용, 없으면 파일 정보 API 조회
      let serverChecksum = downloadChecksum;
      if (!serverChecksum) {
        try {
          console.log('[Download] Fetching file info for checksum...', { fileId });
          updateFileState(id, { status: 'verifying' });
          const fileInfo = await fileApi.getInfo(token, fileId);
          console.log('[Download] File info response:', { 
            fileId, 
            checksum: fileInfo.checksum,
          });
          serverChecksum = fileInfo.checksum;
        } catch (infoError) {
          console.warn('[Download] Failed to get file info for checksum:', infoError);
        }
      }

      // 5. 체크섬 검증 (checksum === SHA256(blob)) - 필수!
      console.log('[Download] Checksum verification:', { serverChecksum: serverChecksum ? `${serverChecksum.slice(0, 16)}...` : 'undefined' });
      if (serverChecksum) {
        updateFileState(id, { status: 'verifying', serverChecksum });

        console.log('[Download] Computing SHA-256 hash...');
        const verificationResult = await verifyChecksum(blob, serverChecksum);
        console.log('[Download] Verification result:', verificationResult);

        if (!verificationResult.isValid) {
          updateFileState(id, {
            status: 'error',
            error: `파일 손상: 체크섬 불일치 (expected: ${verificationResult.expected.slice(0, 8)}..., actual: ${verificationResult.actual.slice(0, 8)}...)`,
            checksumVerified: false,
          });
          return;
        }

        updateFileState(id, { checksumVerified: true });
        console.log('[Download] Checksum verified successfully!');
      } else {
        console.warn('[Download] No server checksum available - skipping verification');
      }

      // 파일 저장
      saveFile(blob, fileName);

      // 완료
      updateFileState(id, {
        status: 'completed',
        progress: 100,
        downloadedSize: fileSize,
        etag,
        checksumVerified: serverChecksum ? true : undefined,
      });

      // localStorage에서 세션 삭제
      removeStoredSession(id);
    } catch (error) {
      if (pauseFlags.current.get(id)) {
        // 일시정지로 인한 중단
        return;
      }
      
      updateFileState(id, {
        status: 'error',
        error: error instanceof Error ? error.message : '다운로드 실패',
      });
    } finally {
      abortControllers.current.delete(id);
      pauseFlags.current.delete(id);
      activeDownloads.current.delete(fileId); // 중복 방지 해제
      
      // 전체 다운로드 상태 확인
      setDownloadFiles((prev) => {
        const stillDownloading = prev.some(
          (f) => f.status === 'downloading' || f.status === 'verifying'
        );
        setIsDownloading(stillDownloading);
        return prev;
      });
    }
  }, [updateFileState]);

  /**
   * 다운로드 일시정지
   */
  const pauseDownload = useCallback((id: string): void => {
    const download = downloadFiles.find((f) => f.id === id);
    if (!download || download.status !== 'downloading') return;

    pauseFlags.current.set(id, true);

    // AbortController로 요청 중단
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
    }

    updateFileState(id, { status: 'paused' });
  }, [downloadFiles, updateFileState]);

  /**
   * 다운로드 재개 (이어받기)
   */
  const resumeDownload = useCallback(async (id: string, token: string): Promise<void> => {
    const download = downloadFiles.find((f) => f.id === id);
    if (!download || (download.status !== 'paused' && download.status !== 'error')) return;

    updateFileState(id, { status: 'downloading' });
    pauseFlags.current.set(id, false);

    try {
      // 1. 이어받기 실행
      const result = await fileApi.resumeDownload(
        token,
        {
          fileId: download.fileId,
          etag: download.etag || '',
          totalSize: download.fileSize,
          downloadedSize: download.downloadedSize,
          chunks: download.chunks || [],
        },
        (percent, downloaded, total) => {
          if (pauseFlags.current.get(id)) return;
          updateFileState(id, {
            progress: percent,
            downloadedSize: downloaded,
          });
        }
      );

      // 2. 일시정지 체크
      if (pauseFlags.current.get(id)) {
        updateFileState(id, {
          status: 'paused',
          etag: result.etag,
        });
        return;
      }

      // 처음부터 다시 다운로드된 경우
      if (result.isRestarted) {
        console.log('[Resume] File changed, restarted download from beginning');
      }

      // 3. 크기 검증 (size === blob.size)
      console.log('[Resume] Size verification:', { expected: download.fileSize, actual: result.blob.size });
      if (result.blob.size !== download.fileSize) {
        console.error(`[Resume] Size mismatch: expected ${download.fileSize}, got ${result.blob.size}`);
        updateFileState(id, {
          status: 'error',
          error: `파일 크기 불일치: 예상 ${download.fileSize} bytes, 실제 ${result.blob.size} bytes`,
          checksumVerified: false,
        });
        return;
      }

      // 4. 체크섬 획득 (다운로드 완료 후 조회 - 효율적)
      // 다운로드 응답 헤더에 체크섬이 있으면 사용, 없으면 파일 정보 API 조회
      let serverChecksum = result.checksum;
      if (!serverChecksum) {
        try {
          console.log('[Resume] Fetching file info for checksum...', { fileId: download.fileId });
          updateFileState(id, { status: 'verifying' });
          const fileInfo = await fileApi.getInfo(token, download.fileId);
          console.log('[Resume] File info response:', { checksum: fileInfo.checksum });
          serverChecksum = fileInfo.checksum;
        } catch (infoError) {
          console.warn('[Resume] Failed to get file info for checksum:', infoError);
        }
      }

      // 5. 체크섬 검증
      console.log('[Resume] Checksum verification:', { serverChecksum: serverChecksum ? `${serverChecksum.slice(0, 16)}...` : 'undefined' });
      if (serverChecksum) {
        updateFileState(id, { 
          status: 'verifying', 
          serverChecksum,
        });

        console.log('[Resume] Computing SHA-256 hash...');
        const verificationResult = await verifyChecksum(result.blob, serverChecksum);
        console.log('[Resume] Verification result:', verificationResult);

        if (!verificationResult.isValid) {
          updateFileState(id, {
            status: 'error',
            error: '파일 손상: 체크섬 불일치',
            checksumVerified: false,
          });
          return;
        }

        updateFileState(id, { checksumVerified: true });
        console.log('[Resume] Checksum verified successfully!');
      } else {
        console.warn('[Resume] No server checksum available - skipping verification');
      }

      // 6. 파일 저장
      saveFile(result.blob, download.fileName);

      // 완료
      updateFileState(id, {
        status: 'completed',
        progress: 100,
        downloadedSize: download.fileSize,
        etag: result.etag,
        checksumVerified: serverChecksum ? true : undefined,
      });

      // localStorage에서 세션 삭제
      removeStoredSession(id);
    } catch (error) {
      if (pauseFlags.current.get(id)) return;
      
      updateFileState(id, {
        status: 'error',
        error: error instanceof Error ? error.message : '이어받기 실패',
      });
    } finally {
      pauseFlags.current.delete(id);
      
      setDownloadFiles((prev) => {
        const stillDownloading = prev.some(
          (f) => f.status === 'downloading' || f.status === 'verifying'
        );
        setIsDownloading(stillDownloading);
        return prev;
      });
    }
  }, [downloadFiles, updateFileState]);

  /**
   * 다운로드 취소
   */
  const cancelDownload = useCallback((id: string): void => {
    const download = downloadFiles.find((f) => f.id === id);
    
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
    }

    updateFileState(id, { status: 'cancelled' });
    removeStoredSession(id);
    abortControllers.current.delete(id);
    pauseFlags.current.delete(id);
    
    // 중복 방지 해제
    if (download) {
      activeDownloads.current.delete(download.fileId);
    }

    setDownloadFiles((prev) => {
      const stillDownloading = prev.some(
        (f) => f.id !== id && (f.status === 'downloading' || f.status === 'verifying')
      );
      setIsDownloading(stillDownloading);
      return prev;
    });
  }, [downloadFiles, updateFileState]);

  /**
   * 완료된 다운로드 제거
   */
  const clearCompleted = useCallback(() => {
    setDownloadFiles((prev) =>
      prev.filter(
        (f) => f.status !== 'completed' && f.status !== 'error' && f.status !== 'cancelled'
      )
    );
  }, []);

  return {
    downloadFiles,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    clearCompleted,
    isDownloading,
  };
}

export default useDownload;
