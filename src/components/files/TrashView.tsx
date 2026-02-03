/**
 * TrashView - 휴지통 뷰
 * 삭제된 파일/폴더 목록 및 복원/영구삭제 기능
 */
import { formatFileSize, formatDate, getFileIcon } from './FileItem';
import type { TrashListResponse } from '../../types/file.types';

interface TrashViewProps {
  trashList: TrashListResponse | null;
  onRestore: (trashMetadataId: string) => void;
  onPermanentDelete: (trashMetadataId: string) => void;
  onEmptyTrash: () => void;
  onRefresh: () => void;
}

export function TrashView({
  trashList,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  onRefresh,
}: TrashViewProps) {
  if (!trashList) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          휴지통 불러오기
        </button>
      </div>
    );
  }

  const isEmpty = trashList.items.length === 0;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">휴지통</h2>
          <p className="text-sm text-gray-500">
            {trashList.totalCount}개 항목 · {formatFileSize(trashList.totalSizeBytes)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            새로고침
          </button>
          {!isEmpty && (
            <button
              onClick={onEmptyTrash}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              휴지통 비우기
            </button>
          )}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        휴지통의 파일은 30일 후 자동으로 영구 삭제됩니다.
      </div>

      {/* 목록 */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <span className="text-6xl mb-4">🗑️</span>
          <p>휴지통이 비어있습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  원래 위치
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  삭제일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  만료
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trashList.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">
                        {item.type === 'FILE' ? getFileIcon(item.mimeType) : '📁'}
                      </span>
                      <span className="text-sm text-gray-900 truncate max-w-[200px]" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]" title={item.originalPath}>
                    {item.originalFolderName || item.originalPath}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatFileSize(item.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(item.deletedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.daysUntilExpiry <= 7 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.daysUntilExpiry}일 남음
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onRestore(item.trashMetadataId)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                        title={item.restoreInfo.pathStatus === 'AVAILABLE' ? '복원' : '원래 경로 없음'}
                      >
                        복원
                      </button>
                      <button
                        onClick={() => onPermanentDelete(item.trashMetadataId)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
