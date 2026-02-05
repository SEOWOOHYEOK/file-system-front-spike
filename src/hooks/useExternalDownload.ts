/**
 * 외부 공유 다운로드 훅
 * 외부 공유 파일 다운로드 상태 관리, 진행률 추적, 체크섬 검증 기능
 */
import { useState, useCallback, useRef } from 'react';
import { externalShareApi } from '../api/externalShareApi';
import { verifyChecksum } from '../utils/checksum';
import type { DownloadFile, DownloadFileStatus } from '../types/file.types';

/**
 * localStorage 키
 */
const STORAGE_KEY = 'external_download_sessions';

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
export interface UseExternalDownloadReturn {
  downloadFiles: DownloadFile[];
  startDownload: (
    accessToken: string,
    shareId: string,
    contentToken: string,
    fileName: string,
    fileSize: number
  ) => Promise<void>;
  cancelDownload: (id: string) => void;
  clearCompleted: () => void;
  isDownloading: boolean;
}

/**
 * 외부 공유 다운로드 훅
 */
export function useExternalDownload(): UseExternalDownloadReturn {
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  /**
   * 다운로드 파일 상태 업데이트
   */
  const updateFileState = useCallback((id: string, update: Partial<DownloadFile>) => {
    setDownloadFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f))
    );
  }, []);

  /**
   * 다운로드 시작
   */
  const startDownload = useCallback(async (
    accessToken: string,
    shareId: string,
    contentToken: string,
    fileName: string,
    fileSize: number
  ): Promise<void> => {
    const id = `ext-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 새 다운로드 파일 추가
    const newDownload: DownloadFile = {
      id,
      fileId: shareId,
      fileName,
      fileSize,
      status: 'downloading',
      progress: 0,
      downloadedSize: 0,
      useParallel: false,
    };

    setDownloadFiles((prev) => [...prev, newDownload]);
    setIsDownloading(true);

    // AbortController 설정
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      // 진행률 추적 다운로드
      const result = await externalShareApi.downloadFileWithProgress(
        accessToken,
        shareId,
        contentToken,
        (percent, downloaded, total) => {
          updateFileState(id, {
            progress: percent,
            downloadedSize: downloaded,
          });
        }
      );

      // 체크섬 검증
      if (result.checksum) {
        updateFileState(id, {
          status: 'verifying',
          serverChecksum: result.checksum,
        });

        const verificationResult = await verifyChecksum(result.blob, result.checksum);

        if (!verificationResult.isValid) {
          updateFileState(id, {
            status: 'error',
            error: `파일 손상: 체크섬 불일치`,
            checksumVerified: false,
          });
          return;
        }

        updateFileState(id, { checksumVerified: true });
      }

      // 파일 저장
      saveFile(result.blob, result.filename || fileName);

      // 완료
      updateFileState(id, {
        status: 'completed',
        progress: 100,
        downloadedSize: fileSize,
        checksumVerified: result.checksum ? true : undefined,
      });
    } catch (error) {
      updateFileState(id, {
        status: 'error',
        error: error instanceof Error ? error.message : '다운로드 실패',
      });
    } finally {
      abortControllers.current.delete(id);

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
   * 다운로드 취소
   */
  const cancelDownload = useCallback((id: string): void => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
    }

    updateFileState(id, { status: 'cancelled' });
    abortControllers.current.delete(id);

    setDownloadFiles((prev) => {
      const stillDownloading = prev.some(
        (f) => f.id !== id && (f.status === 'downloading' || f.status === 'verifying')
      );
      setIsDownloading(stillDownloading);
      return prev;
    });
  }, [updateFileState]);

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
    cancelDownload,
    clearCompleted,
    isDownloading,
  };
}

export default useExternalDownload;
