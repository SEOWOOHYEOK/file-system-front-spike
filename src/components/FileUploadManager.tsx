/**
 * 파일 업로드 매니저 컴포넌트
 * 다중 파일 업로드 진행률을 표시하는 UI 컴포넌트
 */
import React, { useCallback, useRef } from 'react';
import type { UploadFile, UploadFileStatus } from '../hooks/useMultipartUpload';
import type { SyncProgressInfo } from '../types/file.types';

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
 * 파일 확장자로 아이콘 결정
 */
function getFileIcon(fileName: string, mimeType: string): { icon: string; color: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // 이미지
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return { icon: '🖼️', color: 'text-blue-500' };
  }
  
  // 비디오
  if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(ext)) {
    return { icon: '🎬', color: 'text-purple-500' };
  }
  
  // 오디오
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return { icon: '🎵', color: 'text-green-500' };
  }
  
  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { icon: '📄', color: 'text-red-500' };
  }
  
  // 압축 파일
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { icon: '📦', color: 'text-yellow-500' };
  }
  
  // 문서
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'].includes(ext)) {
    return { icon: '📝', color: 'text-blue-600' };
  }
  
  // 기본
  return { icon: '📎', color: 'text-gray-500' };
}

/**
 * 예상 대기 시간 포맷
 */
function formatWaitTime(seconds: number): string {
  if (seconds < 60) return `약 ${seconds}초`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `약 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `약 ${hours}시간 ${remainMinutes}분`;
}

/**
 * 상태별 색상 및 텍스트
 */
function getStatusInfo(
  status: UploadFileStatus, 
  uploadProgress: number, 
  syncProgress: number,
  syncProgressInfo?: SyncProgressInfo,
  queuePosition?: number,
  estimatedWaitSeconds?: number
): {
  barColor: string;
  text: string;
  textColor: string;
} {
  switch (status) {
    case 'pending':
      return { barColor: 'bg-gray-300', text: '대기 중', textColor: 'text-gray-500' };
    case 'queued': {
      const posText = queuePosition ? `${queuePosition}번째` : '';
      const waitText = estimatedWaitSeconds ? formatWaitTime(estimatedWaitSeconds) : '';
      const detail = [posText, waitText].filter(Boolean).join(' · ');
      return {
        barColor: 'bg-indigo-400 animate-pulse',
        text: detail ? `대기열 ${detail}` : '대기열 대기 중',
        textColor: 'text-indigo-600',
      };
    }
    case 'uploading':
      return { barColor: 'bg-blue-500', text: `${uploadProgress}%`, textColor: 'text-blue-600' };
    case 'paused':
      return { barColor: 'bg-yellow-500', text: `일시정지 (${uploadProgress}%)`, textColor: 'text-yellow-600' };
    case 'syncing': {
      // 상세 진행률 정보가 있으면 표시
      const progressText = syncProgressInfo?.percent !== undefined 
        ? `${syncProgressInfo.percent}%` 
        : `${syncProgress}%`;
      return { barColor: 'bg-orange-500', text: `동기화 중 ${progressText}`, textColor: 'text-orange-600' };
    }
    case 'completed':
      return { barColor: 'bg-green-500', text: '완료', textColor: 'text-green-600' };
    case 'error':
      return { barColor: 'bg-red-500', text: '오류', textColor: 'text-red-600' };
    case 'cancelled':
      return { barColor: 'bg-gray-400', text: '취소됨', textColor: 'text-gray-500' };
    default:
      return { barColor: 'bg-gray-300', text: '', textColor: 'text-gray-500' };
  }
}

/**
 * 진행률 계산
 */
function calculateProgress(status: UploadFileStatus, uploadProgress: number, syncProgress: number): number {
  switch (status) {
    case 'pending':
    case 'queued':
      return 0;
    case 'uploading':
      return uploadProgress;
    case 'paused':
      return uploadProgress;
    case 'syncing':
      // 업로드 완료 후 동기화 진행률 표시 (업로드 80% + 동기화 20%)
      return 80 + (syncProgress * 0.2);
    case 'completed':
      return 100;
    case 'error':
    case 'cancelled':
      return uploadProgress;
    default:
      return 0;
  }
}

/**
 * 파일 아이템 Props
 */
interface FileItemProps {
  uploadFile: UploadFile;
  onRemove: () => void;
  onCancel: () => void;
  onPause?: () => void;
  onResume?: () => void;
  needsFileForResume?: boolean;
}

/**
 * 동기화 상세 진행률 표시 컴포넌트
 */
const SyncProgressDetail: React.FC<{ info?: SyncProgressInfo; message?: string }> = ({ info, message }) => {
  if (!info) return null;
  
  const hasChunkInfo = info.completedChunks !== undefined && info.totalChunks !== undefined;
  const hasByteInfo = info.bytesTransferred !== undefined && info.totalBytes !== undefined;
  
  return (
    <div className="text-xs text-orange-500 mt-1 flex items-center gap-2 flex-wrap">
      {message && <span>{message}</span>}
      {hasChunkInfo && (
        <span className="bg-orange-100 px-1.5 py-0.5 rounded">
          청크: {info.completedChunks}/{info.totalChunks}
        </span>
      )}
      {hasByteInfo && (
        <span className="bg-orange-100 px-1.5 py-0.5 rounded">
          {formatFileSize(info.bytesTransferred!)}/{formatFileSize(info.totalBytes!)}
        </span>
      )}
    </div>
  );
};

/**
 * 파일 아이템 컴포넌트
 */
const FileItem: React.FC<FileItemProps> = ({ 
  uploadFile, 
  onRemove, 
  onCancel, 
  onPause, 
  onResume,
  needsFileForResume = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileName = uploadFile.file?.name || '파일을 다시 선택해주세요';
  const fileType = uploadFile.file?.type || '';
  const fileSize = uploadFile.file?.size || 0;
  
  const { icon, color } = getFileIcon(fileName, fileType);
  const { barColor, text, textColor } = getStatusInfo(
    uploadFile.status,
    uploadFile.uploadProgress,
    uploadFile.syncProgress,
    uploadFile.syncProgressInfo,
    uploadFile.queuePosition,
    uploadFile.estimatedWaitSeconds
  );
  const progress = calculateProgress(
    uploadFile.status,
    uploadFile.uploadProgress,
    uploadFile.syncProgress
  );

  const canCancel = ['uploading', 'syncing', 'queued'].includes(uploadFile.status);
  const canPause = uploadFile.status === 'uploading' && onPause;
  const canResume = (uploadFile.status === 'paused' || uploadFile.status === 'error') && onResume;

  // 파일 선택 후 이어서 업로드
  const handleFileSelectForResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onResume) {
      // onResume에서 file을 전달하기 위해 커스텀 이벤트 사용
      (onResume as (file?: File) => void)(file);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      {/* 파일 아이콘 */}
      <div className={`text-2xl ${color}`}>
        {uploadFile.status === 'completed' ? '✅' : 
         uploadFile.status === 'error' ? '❌' : 
         uploadFile.status === 'paused' ? '⏸️' :
         uploadFile.status === 'queued' ? '🕐' : icon}
      </div>

      {/* 파일 정보 및 진행률 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="truncate font-medium text-gray-800">
            {fileName}
          </div>
          <div className={`text-sm font-medium ${textColor} whitespace-nowrap ml-2`}>
            {text}
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mb-1">
          {fileSize > 0 ? formatFileSize(fileSize) : '크기 정보 없음'}
          {(uploadFile.status === 'uploading' || uploadFile.status === 'paused') && uploadFile.totalParts > 0 && (
            <span className="ml-2">
              ({uploadFile.completedParts.length}/{uploadFile.totalParts} 파트)
            </span>
          )}
        </div>

        {/* 진행률 바 */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 대기열 상세 정보 */}
        {uploadFile.status === 'queued' && (
          <div className="text-xs text-indigo-500 mt-1 flex items-center gap-2 flex-wrap">
            {uploadFile.queuePosition && (
              <span className="bg-indigo-100 px-1.5 py-0.5 rounded">
                순번: {uploadFile.queuePosition}번째
              </span>
            )}
            {uploadFile.estimatedWaitSeconds && (
              <span className="bg-indigo-100 px-1.5 py-0.5 rounded">
                예상 대기: {formatWaitTime(uploadFile.estimatedWaitSeconds)}
              </span>
            )}
          </div>
        )}

        {/* 동기화 상세 진행률 */}
        {uploadFile.status === 'syncing' && uploadFile.syncProgressInfo && (
          <SyncProgressDetail 
            info={uploadFile.syncProgressInfo} 
            message={uploadFile.syncMessage}
          />
        )}

        {/* 에러 메시지 */}
        {uploadFile.status === 'error' && uploadFile.error && (
          <div className="text-xs text-red-500 mt-1 truncate">
            {uploadFile.error}
          </div>
        )}

        {/* 파일 다시 선택 안내 (새로고침 후 이어서 업로드 시) */}
        {needsFileForResume && uploadFile.status === 'paused' && !uploadFile.file && (
          <div className="text-xs text-yellow-600 mt-1">
            이어서 업로드하려면 파일을 다시 선택해주세요
          </div>
        )}
      </div>

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-1">
        {/* 일시정지 버튼 */}
        {canPause && (
          <button
            onClick={onPause}
            className="p-1 hover:bg-yellow-100 rounded transition-colors"
            title="일시정지"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
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

        {/* 이어서 업로드 버튼 */}
        {canResume && (
          <>
            {needsFileForResume && !uploadFile.file ? (
              // 파일 선택이 필요한 경우
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 hover:bg-green-100 rounded transition-colors"
                  title="파일 선택 후 이어서 업로드"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-500 hover:text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelectForResume}
                />
              </>
            ) : (
              // 파일이 있는 경우 바로 이어서 업로드
              <button
                onClick={() => onResume && onResume()}
                className="p-1 hover:bg-green-100 rounded transition-colors"
                title="이어서 업로드"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
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
          </>
        )}

        {/* 제거/취소 버튼 */}
        <button
          onClick={canCancel ? onCancel : onRemove}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title={canCancel ? '취소' : '제거'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
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
      </div>
    </div>
  );
};

/**
 * FileUploadManager Props
 */
interface FileUploadManagerProps {
  uploadFiles: UploadFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onCancelFile: (id: string) => void;
  onPauseFile?: (id: string) => void;
  onResumeFile?: (id: string, file?: File) => void;
  onStartUpload: () => void;
  onCancelAll: () => void;
  onClearCompleted: () => void;
  isUploading: boolean;
  disabled?: boolean;
  hasPendingSessions?: boolean;
  onLoadPendingSessions?: () => void;
}

/**
 * 파일 업로드 매니저 컴포넌트
 */
export const FileUploadManager: React.FC<FileUploadManagerProps> = ({
  uploadFiles,
  onAddFiles,
  onRemoveFile,
  onCancelFile,
  onPauseFile,
  onResumeFile,
  onStartUpload,
  onCancelAll,
  onClearCompleted,
  isUploading,
  disabled = false,
  hasPendingSessions = false,
  onLoadPendingSessions,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAddFiles(Array.from(files));
    }
    // 입력 초기화 (같은 파일 재선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onAddFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onAddFiles(files);
    }
  }, [onAddFiles, disabled, isUploading]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 통계 계산
  const stats = {
    total: uploadFiles.length,
    pending: uploadFiles.filter((f) => f.status === 'pending').length,
    queued: uploadFiles.filter((f) => f.status === 'queued').length,
    uploading: uploadFiles.filter((f) => f.status === 'uploading' || f.status === 'syncing').length,
    paused: uploadFiles.filter((f) => f.status === 'paused').length,
    completed: uploadFiles.filter((f) => f.status === 'completed').length,
    error: uploadFiles.filter((f) => f.status === 'error').length,
  };

  const hasCompleted = stats.completed > 0 || stats.error > 0;
  const hasPending = stats.pending > 0;
  const hasPaused = stats.paused > 0;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">파일 업로드</h3>
          <div className="flex items-center gap-2">
            {hasPendingSessions && onLoadPendingSessions && (
              <button
                onClick={onLoadPendingSessions}
                className="px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded transition-colors"
              >
                미완료 업로드 불러오기
              </button>
            )}
            {stats.total > 0 && (
              <span className="text-sm text-gray-500">
                {stats.completed}/{stats.total} 완료
                {stats.queued > 0 && ` (${stats.queued}개 대기열)`}
                {stats.paused > 0 && ` (${stats.paused}개 일시정지)`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 드롭 영역 / 파일 선택 */}
      <div
        className={`
          p-4 border-2 border-dashed border-gray-300 rounded-lg m-4
          ${disabled || isUploading ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-blue-50 cursor-pointer'}
          transition-colors
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            {disabled || isUploading
              ? '업로드 중...'
              : '파일을 드래그하거나 클릭하여 선택하세요'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            100MB 이상의 파일은 자동으로 멀티파트 업로드됩니다
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
        />
      </div>

      {/* 파일 목록 */}
      {uploadFiles.length > 0 && (
        <div className="px-4 pb-4">
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {uploadFiles.map((uploadFile) => (
              <FileItem
                key={uploadFile.id}
                uploadFile={uploadFile}
                onRemove={() => onRemoveFile(uploadFile.id)}
                onCancel={() => onCancelFile(uploadFile.id)}
                onPause={onPauseFile ? () => onPauseFile(uploadFile.id) : undefined}
                onResume={onResumeFile ? (file?: File) => onResumeFile(uploadFile.id, file) : undefined}
                needsFileForResume={!uploadFile.file}
              />
            ))}
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {hasCompleted && (
                <button
                  onClick={onClearCompleted}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                >
                  완료 항목 정리
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {isUploading && (
                <button
                  onClick={onCancelAll}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 hover:bg-red-50 rounded transition-colors"
                >
                  전체 취소
                </button>
              )}
              
              {hasPaused && !isUploading && (
                <span className="text-sm text-yellow-600">
                  {stats.paused}개 일시정지됨 - 개별 재개 버튼을 클릭하세요
                </span>
              )}
              
              {hasPending && !isUploading && (
                <button
                  onClick={onStartUpload}
                  disabled={disabled}
                  className={`
                    px-4 py-2 text-sm text-white rounded transition-colors
                    ${disabled
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'}
                  `}
                >
                  업로드 시작 ({stats.pending}개)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {uploadFiles.length === 0 && (
        <div className="px-4 pb-4 text-center text-gray-400 text-sm">
          업로드할 파일을 추가하세요
        </div>
      )}
    </div>
  );
};

export default FileUploadManager;
