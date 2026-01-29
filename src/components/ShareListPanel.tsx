/**
 * ShareListPanel Component
 * 공유된 파일 목록 표시
 */
import type { PublicShare } from '../types/api.types';

interface ShareListPanelProps {
  shares: PublicShare[];
  selectedShareId: string | null;
  onSelectShare: (share: PublicShare) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ShareListPanel({
  shares,
  selectedShareId,
  onSelectShare,
  loading = false,
  disabled = false,
}: ShareListPanelProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">공유 목록</h2>
      
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          로딩 중...
        </div>
      ) : shares.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          공유된 파일이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {shares.map((share) => (
            <div
              key={share.id}
              onClick={() => !disabled && onSelectShare(share)}
              className={`
                p-3 rounded border cursor-pointer transition-colors
                ${selectedShareId === share.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {share.fileName || share.fileId}
                  </div>
                  <div className="text-sm text-gray-500">
                    만료: {formatDate(share.expiresAt)}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
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
              
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>조회: {share.currentViewCount}/{share.maxViewCount ?? '∞'}</span>
                <span>다운로드: {share.currentDownloadCount}/{share.maxDownloadCount ?? '∞'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
