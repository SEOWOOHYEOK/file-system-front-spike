/**
 * TrashView - 휴지통 뷰
 * 삭제된 파일/폴더 목록 및 복원/영구삭제 기능
 *
 * API:
 *   GET    /v1/trash                    - 목록 조회
 *   DELETE /v1/trash/{trashMetadataId}  - 영구삭제
 *   POST   /v1/trash/restore/execute    - 복원 실행
 */
import { useState } from 'react';
import { formatFileSize, formatDate, getFileIcon } from './FileItem';
import type { TrashListResponse, TrashItem, TrashFileItem, TrashFolderItem, TrashListTypeFilter } from '../../types/file.types';

interface TrashViewProps {
  trashList: TrashListResponse | null;
  onRestore: (trashMetadataId: string) => void;
  onPermanentDelete: (trashMetadataId: string) => void;
  onRefresh: (query?: { page?: number; type?: TrashListTypeFilter; search?: string }) => void;
}

function getItemName(item: TrashItem): string {
  return item.type === 'FILE' ? item.fileInfo.name : item.folderInfo.name;
}

function getItemSize(item: TrashItem): number {
  return item.type === 'FILE' ? item.fileInfo.sizeBytes : item.totalSizeBytes;
}

function getItemIcon(item: TrashItem): string {
  if (item.type === 'FOLDER') return '\uD83D\uDCC1';
  return getFileIcon(item.fileInfo.mimeType);
}

export function TrashView({
  trashList,
  onRestore,
  onPermanentDelete,
  onRefresh,
}: TrashViewProps) {
  const [typeFilter, setTypeFilter] = useState<TrashListTypeFilter>('ALL');
  const [searchText, setSearchText] = useState('');

  if (!trashList) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <button
          onClick={() => onRefresh()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          휴지통 불러오기
        </button>
      </div>
    );
  }

  const isEmpty = trashList.items.length === 0;

  const handleSearch = () => {
    onRefresh({ search: searchText || undefined, type: typeFilter, page: 1 });
  };

  const handleTypeChange = (type: TrashListTypeFilter) => {
    setTypeFilter(type);
    onRefresh({ type, search: searchText || undefined, page: 1 });
  };

  const handlePageChange = (page: number) => {
    onRefresh({ page, type: typeFilter, search: searchText || undefined });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">휴지통</h2>
          <p className="text-sm text-gray-500">
            총 {trashList.totalCount}개 항목 · {formatFileSize(trashList.totalSizeBytes)}
          </p>
        </div>
        <button
          onClick={() => onRefresh({ type: typeFilter, search: searchText || undefined })}
          className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          새로고침
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        휴지통의 파일은 30일 후 자동으로 영구 삭제됩니다.
      </div>

      {/* 필터 & 검색 */}
      <div className="flex items-center gap-3">
        {/* 타입 필터 */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['ALL', 'FILE', 'FOLDER'] as TrashListTypeFilter[]).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1.5 text-xs font-medium ${
                typeFilter === type
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type === 'ALL' ? '전체' : type === 'FILE' ? '파일' : '폴더'}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="flex items-center gap-1 flex-1 max-w-sm">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="파일명/폴더명 검색..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            검색
          </button>
        </div>

        {trashList.search && (
          <span className="text-xs text-gray-500">
            검색: "{trashList.search}"
          </span>
        )}
      </div>

      {/* 목록 */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <span className="text-6xl mb-4">{'\uD83D\uDDD1\uFE0F'}</span>
          <p>휴지통이 비어있습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  타입
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  크기
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  원래 위치
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  삭제자
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  삭제일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  만료
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  경로상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trashList.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {/* 타입 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      item.type === 'FILE'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.type === 'FILE' ? 'FILE' : 'FOLDER'}
                    </span>
                  </td>

                  {/* 이름 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{getItemIcon(item)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={getItemName(item)}>
                          {getItemName(item)}
                        </div>
                        {item.type === 'FILE' && (
                          <div className="text-xs text-gray-400">{item.fileInfo.mimeType}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 크기 */}
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatFileSize(getItemSize(item))}
                  </td>

                  {/* 원래 위치 */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-500 truncate max-w-[180px]" title={item.originalPath}>
                      {item.originalPath}
                    </div>
                  </td>

                  {/* 삭제자 */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{item.deleteUserInfo.name}</div>
                    {item.deleteUserInfo.departmentName && (
                      <div className="text-xs text-gray-400">{item.deleteUserInfo.departmentName}</div>
                    )}
                    {item.deleteUserInfo.email && (
                      <div className="text-xs text-gray-400">{item.deleteUserInfo.email}</div>
                    )}
                  </td>

                  {/* 삭제일 */}
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(item.deletedAt)}
                  </td>

                  {/* 만료 */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className={`text-xs px-2 py-0.5 rounded inline-block w-fit ${
                        item.daysUntilExpiry <= 7
                          ? 'bg-red-100 text-red-800'
                          : item.daysUntilExpiry <= 14
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.daysUntilExpiry}일 남음
                      </span>
                      <span className="text-xs text-gray-400 mt-0.5">
                        {formatDate(item.expiresAt)}
                      </span>
                    </div>
                  </td>

                  {/* 경로상태 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      item.restoreInfo.pathStatus === 'AVAILABLE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {item.restoreInfo.pathStatus === 'AVAILABLE' ? '복구가능' : '경로없음'}
                    </span>
                  </td>

                  {/* 작업 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onRestore(item.id)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                        title={item.restoreInfo.pathStatus === 'AVAILABLE' ? '복원' : '원래 경로 없음 - 복원 시 경로 지정 필요'}
                      >
                        복원
                      </button>
                      <button
                        onClick={() => onPermanentDelete(item.id)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
                      >
                        영구삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {trashList.pagination && trashList.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => handlePageChange(trashList.pagination.page - 1)}
            disabled={!trashList.pagination.hasPrev}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {trashList.pagination.page} / {trashList.pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(trashList.pagination.page + 1)}
            disabled={!trashList.pagination.hasNext}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}

      {/* API 응답 상세 (디버그용) */}
      <details className="mt-4">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          API 응답 상세 보기
        </summary>
        <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 overflow-x-auto max-h-64 overflow-y-auto">
          {JSON.stringify(trashList, null, 2)}
        </pre>
      </details>
    </div>
  );
}
