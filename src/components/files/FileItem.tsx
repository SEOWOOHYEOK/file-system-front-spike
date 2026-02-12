/**
 * FileItem - 파일/폴더 아이템 컴포넌트
 * 그리드/리스트 뷰에서 공통으로 사용되는 아이템 표시
 */

// 파일 타입별 아이콘 반환
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
  if (mimeType.includes('text')) return '📄';
  return '📄';
}

// MIME 타입을 사람이 읽기 쉬운 한글로 변환
export function formatMimeType(mimeType: string): string {
  if (!mimeType) return '-';
  
  // 이미지
  if (mimeType.startsWith('image/')) {
    const subtype = mimeType.split('/')[1]?.toUpperCase();
    return `이미지 (${subtype})`;
  }
  // 비디오
  if (mimeType.startsWith('video/')) {
    const subtype = mimeType.split('/')[1]?.toUpperCase();
    return `비디오 (${subtype})`;
  }
  // 오디오
  if (mimeType.startsWith('audio/')) {
    const subtype = mimeType.split('/')[1]?.toUpperCase();
    return `오디오 (${subtype})`;
  }
  // PDF
  if (mimeType.includes('pdf')) return 'PDF 문서';
  // Word
  if (mimeType.includes('word') || mimeType.includes('msword') || mimeType.includes('wordprocessingml')) {
    return 'Word 문서';
  }
  // Excel
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return 'Excel 스프레드시트';
  }
  // PowerPoint
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return 'PowerPoint 프레젠테이션';
  }
  // 압축 파일
  if (mimeType.includes('zip')) return 'ZIP 압축파일';
  if (mimeType.includes('rar')) return 'RAR 압축파일';
  if (mimeType.includes('tar')) return 'TAR 압축파일';
  if (mimeType.includes('gzip') || mimeType.includes('gz')) return 'GZIP 압축파일';
  // 텍스트
  if (mimeType === 'text/plain') return '텍스트 파일';
  if (mimeType === 'text/html') return 'HTML 파일';
  if (mimeType === 'text/css') return 'CSS 파일';
  if (mimeType === 'text/csv') return 'CSV 파일';
  if (mimeType.includes('javascript') || mimeType.includes('ecmascript')) return 'JavaScript 파일';
  if (mimeType.includes('json')) return 'JSON 파일';
  if (mimeType.includes('xml')) return 'XML 파일';
  // 기타 텍스트
  if (mimeType.startsWith('text/')) return '텍스트 파일';
  // application 타입
  if (mimeType.startsWith('application/')) {
    const subtype = mimeType.split('/')[1];
    if (subtype) {
      // 일반적인 확장자 기반 타입명 추출
      const cleanSubtype = subtype.replace(/^x-/, '').replace(/^vnd\./, '').toUpperCase();
      return `${cleanSubtype} 파일`;
    }
  }
  
  return mimeType;
}

// 파일 크기 포맷
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// 날짜 포맷
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return '어제';
  }
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

interface FileItemGridProps {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  updatedAt: string;
  isSelected: boolean;
  isFavorite: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function FileItemGrid({
  name,
  type,
  mimeType,
  isSelected,
  isFavorite,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileItemGridProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`relative p-4 rounded-lg cursor-pointer transition-all group ${
        isSelected
          ? 'bg-blue-50 ring-2 ring-blue-500'
          : 'bg-white hover:bg-gray-50 hover:shadow-md'
      }`}
    >
      {/* 즐겨찾기 표시 */}
      {isFavorite && (
        <span className="absolute top-2 right-2 text-yellow-400">⭐</span>
      )}

      {/* 선택 체크박스 */}
      {isSelected && (
        <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* 아이콘 */}
      <div className="flex justify-center mb-3">
        <span className="text-5xl">
          {type === 'folder' ? '📁' : getFileIcon(mimeType || '')}
        </span>
      </div>

      {/* 이름 */}
      <div className="text-center">
        <p className="text-sm text-gray-900 truncate" title={name}>
          {name}
        </p>
      </div>
    </div>
  );
}

/** 등록자 정보 (FileItemList용) */
interface CreatedByInfo {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
}

interface FileItemListProps {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  /** 등록자 정보 */
  createdBy?: CreatedByInfo | null;
  updatedAt: string;
  folderCount?: number;
  fileCount?: number;
  isSelected: boolean;
  isFavorite: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function FileItemList({
  name,
  type,
  mimeType,
  size,
  createdBy,
  updatedAt,
  folderCount,
  fileCount,
  isSelected,
  isFavorite,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileItemListProps) {
  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center">
          {/* 체크박스 */}
          <div className={`w-5 h-5 mr-3 rounded border flex items-center justify-center ${
            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* 아이콘 */}
          <span className="text-2xl mr-3">
            {type === 'folder' ? '📁' : getFileIcon(mimeType || '')}
          </span>

          {/* 이름 */}
          <span className="text-sm text-gray-900 truncate max-w-xs" title={name}>
            {name}
          </span>

          {/* 즐겨찾기 */}
          {isFavorite && (
            <span className="ml-2 text-yellow-400">⭐</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {type === 'folder' ? (
          <span className="text-gray-400">폴더</span>
        ) : (
          <span title={mimeType}>{formatMimeType(mimeType || '')}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {type === 'folder' ? (
          <span>{folderCount}폴더, {fileCount}파일</span>
        ) : (
          formatFileSize(size || 0)
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {createdBy ? (
          <span title={`${createdBy.name} (${createdBy.employeeNumber})`}>
            {createdBy.name}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDate(updatedAt)}
      </td>
    </tr>
  );
}
