/**
 * 파일 업로드 모달 컴포넌트
 * 201. 대용량 파일 업로드 화면 - 모달 형태의 업로드 UI
 */
import React from 'react';
import { FileUploadManager } from './FileUploadManager';
import type { UploadFile } from '../hooks/useMultipartUpload';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
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
}) => {
  if (!isOpen) return null;

  // 업로드 중이거나 파일이 있으면 닫기 전 확인
  const handleClose = () => {
    if (isUploading) {
      if (confirm('업로드가 진행 중입니다. 모달을 닫으시겠습니까?\n(업로드는 백그라운드에서 계속됩니다)')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // 배경 클릭 시 닫기 (업로드 중이 아닐 때만)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isUploading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 z-10 p-1.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
          title="닫기"
        >
          <svg
            className="w-5 h-5 text-gray-500"
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

        {/* 업로드 매니저 */}
        <FileUploadManager
          uploadFiles={uploadFiles}
          onAddFiles={onAddFiles}
          onRemoveFile={onRemoveFile}
          onCancelFile={onCancelFile}
          onPauseFile={onPauseFile}
          onResumeFile={onResumeFile}
          onStartUpload={onStartUpload}
          onCancelAll={onCancelAll}
          onClearCompleted={onClearCompleted}
          isUploading={isUploading}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default FileUploadModal;
