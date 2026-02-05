/**
 * 파일 다운로드 매니저 컴포넌트
 * 다운로드 진행률, 일시정지, 이어받기, 체크섬 검증 상태를 표시하는 UI 컴포넌트
 */
import React, { useState } from 'react';
import type { DownloadFile, DownloadFileStatus } from '../types/file.types';

/**
 * 파일 크기 포맷
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 상태별 색상 및 텍스트
 */
function getStatusInfo(
  status: DownloadFileStatus,
  progress: number,
  checksumVerified?: boolean
): {
  barColor: string;
  text: string;
  textColor: string;
} {
  switch (status) {
    case 'pending':
      return { barColor: 'bg-gray-300', text: '대기 중', textColor: 'text-gray-500' };
    case 'downloading':
      return { barColor: 'bg-blue-500', text: `${progress}%`, textColor: 'text-blue-600' };
    case 'paused':
      return { barColor: 'bg-yellow-500', text: `일시정지 (${progress}%)`, textColor: 'text-yellow-600' };
    case 'verifying':
      return { barColor: 'bg-orange-500', text: '무결성 검증 중...', textColor: 'text-orange-600' };
    case 'completed':
      if (checksumVerified === true) {
        return { barColor: 'bg-green-500', text: '완료', textColor: 'text-green-600' };
      } else if (checksumVerified === false) {
        return { barColor: 'bg-red-500', text: '검증 실패', textColor: 'text-red-600' };
      } else {
        // checksumVerified === undefined (서버에서 체크섬을 제공하지 않음)
        return { barColor: 'bg-green-500', text: '완료', textColor: 'text-green-600' };
      }
    case 'error':
      return { barColor: 'bg-red-500', text: '오류', textColor: 'text-red-600' };
    case 'cancelled':
      return { barColor: 'bg-gray-400', text: '취소됨', textColor: 'text-gray-500' };
    default:
      return { barColor: 'bg-gray-300', text: '', textColor: 'text-gray-500' };
  }
}

/**
 * 상태별 아이콘
 */
function getStatusIcon(status: DownloadFileStatus, checksumVerified?: boolean): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'downloading':
      return '⬇️';
    case 'paused':
      return '⏸️';
    case 'verifying':
      return '🔍';
    case 'completed':
      return checksumVerified ? '✅' : '✓';
    case 'error':
      return '❌';
    case 'cancelled':
      return '🚫';
    default:
      return '📄';
  }
}

/**
 * 다운로드 아이템 Props
 */
interface DownloadItemProps {
  download: DownloadFile;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

/**
 * 다운로드 아이템 컴포넌트
 */
const DownloadItem: React.FC<DownloadItemProps> = ({
  download,
  onPause,
  onResume,
  onCancel,
  onRemove,
}) => {
  const { barColor, text, textColor } = getStatusInfo(
    download.status,
    download.progress,
    download.checksumVerified
  );
  const icon = getStatusIcon(download.status, download.checksumVerified);

  const canPause = download.status === 'downloading';
  const canResume = download.status === 'paused' || download.status === 'error';
  const canCancel = download.status === 'downloading' || download.status === 'verifying';
  const canRemove = ['completed', 'error', 'cancelled', 'paused'].includes(download.status);

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      {/* 상태 아이콘 */}
      <div className="text-2xl flex-shrink-0">
        {icon}
      </div>

      {/* 파일 정보 및 진행률 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="truncate font-medium text-gray-800">
            {download.fileName}
          </div>
          <div className={`text-sm font-medium ${textColor} whitespace-nowrap ml-2`}>
            {text}
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-1 flex items-center flex-wrap gap-1">
          <span>{formatFileSize(download.downloadedSize)} / {formatFileSize(download.fileSize)}</span>
          {download.useParallel && (
            <span className="text-blue-500">(병렬 다운로드)</span>
          )}
          {/* 체크섬 검증 상태 배지 */}
          {download.status === 'completed' && (
            download.checksumVerified === true ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                체크섬 OK
              </span>
            ) : download.checksumVerified === false ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                체크섬 실패
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                체크섬 미제공
              </span>
            )
          )}
        </div>

        {/* 진행률 바 */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${download.progress}%` }}
          />
        </div>

        {/* 에러 메시지 */}
        {download.status === 'error' && download.error && (
          <div className="text-xs text-red-500 mt-1 truncate" title={download.error}>
            {download.error}
          </div>
        )}

        {/* 체크섬 검증 실패 메시지 */}
        {download.status === 'error' && download.checksumVerified === false && (
          <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            파일 무결성 검증 실패 - 다시 다운로드하세요
          </div>
        )}
      </div>

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* 일시정지 버튼 */}
        {canPause && (
          <button
            onClick={onPause}
            className="p-1.5 hover:bg-yellow-100 rounded transition-colors"
            title="일시정지"
          >
            <svg
              className="h-5 w-5 text-yellow-500 hover:text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}

        {/* 이어받기 버튼 */}
        {canResume && (
          <button
            onClick={onResume}
            className="p-1.5 hover:bg-green-100 rounded transition-colors"
            title="이어받기"
          >
            <svg
              className="h-5 w-5 text-green-500 hover:text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}

        {/* 취소 버튼 */}
        {canCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            title="취소"
          >
            <svg
              className="h-5 w-5 text-red-400 hover:text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* 제거 버튼 */}
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="제거"
          >
            <svg
              className="h-5 w-5 text-gray-400 hover:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * FileDownloadManager Props
 */
interface FileDownloadManagerProps {
  downloads: DownloadFile[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
  isDownloading: boolean;
}

/**
 * 파일 다운로드 매니저 컴포넌트
 */
export const FileDownloadManager: React.FC<FileDownloadManagerProps> = ({
  downloads,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
  isDownloading,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 통계 계산
  const stats = {
    total: downloads.length,
    downloading: downloads.filter((f) => f.status === 'downloading').length,
    verifying: downloads.filter((f) => f.status === 'verifying').length,
    paused: downloads.filter((f) => f.status === 'paused').length,
    completed: downloads.filter((f) => f.status === 'completed').length,
    verified: downloads.filter((f) => f.status === 'completed' && f.checksumVerified === true).length,
    unverified: downloads.filter((f) => f.status === 'completed' && f.checksumVerified === undefined).length,
    error: downloads.filter((f) => f.status === 'error').length,
  };

  const activeCount = stats.downloading + stats.verifying;
  const hasCompleted = stats.completed > 0 || stats.error > 0;

  // 다운로드가 없으면 표시하지 않음
  if (downloads.length === 0) {
    return null;
  }

  return (
    <div className="border-t bg-white">
      {/* 헤더 */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            다운로드
            {activeCount > 0 && (
              <span className="ml-1 text-blue-600">({activeCount}개 진행 중)</span>
            )}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {stats.verifying > 0 && (
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
              {stats.verifying}개 검증 중
            </span>
          )}
          {stats.paused > 0 && (
            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
              {stats.paused}개 일시정지
            </span>
          )}
          {stats.verified > 0 && (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {stats.verified}개 검증 완료
            </span>
          )}
          {stats.unverified > 0 && (
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              {stats.unverified}개 완료
            </span>
          )}
          {stats.error > 0 && (
            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
              {stats.error}개 오류
            </span>
          )}
        </div>
      </div>

      {/* 다운로드 목록 */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {downloads.map((download) => (
              <DownloadItem
                key={download.id}
                download={download}
                onPause={() => onPause(download.id)}
                onResume={() => onResume(download.id)}
                onCancel={() => onCancel(download.id)}
                onRemove={() => onCancel(download.id)}
              />
            ))}
          </div>

          {/* 하단 액션 버튼 */}
          {hasCompleted && (
            <div className="flex justify-end mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={onClearCompleted}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                완료 항목 정리
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileDownloadManager;
