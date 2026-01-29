/**
 * ShareDetailPanel Component
 * 공유 상세 정보 및 콘텐츠 토큰 표시
 */
import type { ShareDetailResponse } from '../types/api.types';

interface ShareDetailPanelProps {
  detail: ShareDetailResponse | null;
  onView: () => void;
  onDownload: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ShareDetailPanel({
  detail,
  onView,
  onDownload,
  loading = false,
  disabled = false,
}: ShareDetailPanelProps) {
  if (!detail) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">공유 상세</h2>
        <div className="text-center py-8 text-gray-500">
          왼쪽에서 공유를 선택하세요.
        </div>
      </div>
    );
  }

  const { share, contentToken } = detail;
  const hasViewPermission = share.permissions.includes('VIEW');
  const hasDownloadPermission = share.permissions.includes('DOWNLOAD');

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">공유 상세</h2>
      
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          로딩 중...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">파일명</div>
              <div className="font-medium">{share.fileName || share.fileId}</div>
            </div>
            <div>
              <div className="text-gray-600">크기</div>
              <div className="font-medium">{formatBytes(share.fileSize)}</div>
            </div>
            <div>
              <div className="text-gray-600">MIME Type</div>
              <div className="font-mono text-xs">{share.mimeType || '-'}</div>
            </div>
            <div>
              <div className="text-gray-600">권한</div>
              <div className="flex gap-1">
                {share.permissions.map((perm) => (
                  <span
                    key={perm}
                    className={`
                      px-2 py-0.5 text-xs rounded
                      ${perm === 'VIEW' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
                    `}
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="text-sm text-gray-600 mb-1">콘텐츠 토큰 (60초 유효)</div>
            <div className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
              {contentToken}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onView}
              disabled={!hasViewPermission || disabled}
              className={`
                flex-1 px-3 py-2 rounded text-sm font-medium
                ${hasViewPermission 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'}
                disabled:opacity-50
              `}
            >
              VIEW (뷰어)
            </button>
            <button
              onClick={onDownload}
              disabled={!hasDownloadPermission || disabled}
              className={`
                flex-1 px-3 py-2 rounded text-sm font-medium
                ${hasDownloadPermission 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'}
                disabled:opacity-50
              `}
            >
              DOWNLOAD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
