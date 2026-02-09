/**
 * FileToolbar - 파일 관리 툴바
 * 검색, 검색 내역, 새 폴더, 업로드, 뷰 전환, 정렬 기능
 */
import { useState, useRef, useEffect } from 'react';
import type { SearchHistoryItem } from '../../types/file.types';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'updatedAt' | 'size';
type SortOrder = 'asc' | 'desc';

interface FileToolbarProps {
  searchKeyword: string;
  onSearchChange: (keyword: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  isSearchMode: boolean;
  onCreateFolder: () => void;
  onUpload: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortChange: (sortBy: SortBy) => void;
  disabled?: boolean;
  // 검색 내역 관련
  searchHistory: SearchHistoryItem[];
  searchHistoryLoading?: boolean;
  onFetchSearchHistory: () => void;
  onDeleteSearchHistory: (historyId: string) => void;
  onDeleteAllSearchHistory: () => void;
  onSelectSearchHistory: (keyword: string) => void;
}

export function FileToolbar({
  searchKeyword,
  onSearchChange,
  onSearch,
  onClearSearch,
  isSearchMode,
  onCreateFolder,
  onUpload,
  viewMode,
  onViewModeChange,
  sortBy,
  sortOrder,
  onSortChange,
  disabled = false,
  searchHistory,
  searchHistoryLoading = false,
  onFetchSearchHistory,
  onDeleteSearchHistory,
  onDeleteAllSearchHistory,
  onSelectSearchHistory,
}: FileToolbarProps) {
  const [showHistory, setShowHistory] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
      setShowHistory(false);
    }
    if (e.key === 'Escape') {
      setShowHistory(false);
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    onFetchSearchHistory();
    setShowHistory(true);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectHistory = (keyword: string) => {
    onSelectSearchHistory(keyword);
    setShowHistory(false);
  };

  const handleDeleteHistoryItem = (e: React.MouseEvent, historyId: string) => {
    e.stopPropagation();
    onDeleteSearchHistory(historyId);
  };

  const handleDeleteAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteAllSearchHistory();
  };

  // 검색 내역에서 현재 입력과 매칭되는 항목 필터링
  const filteredHistory = searchKeyword.trim()
    ? searchHistory.filter((item) =>
        item.keyword.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : searchHistory;

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'name', label: '이름' },
    { value: 'updatedAt', label: '수정일' },
    { value: 'size', label: '크기' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* 좌측: 검색 */}
        <div
          ref={searchContainerRef}
          className="flex items-center space-x-2 flex-1 max-w-md relative"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchKeyword}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder="파일/폴더 검색 (최소 2자)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={disabled}
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>

            {/* 검색 내역 드롭다운 */}
            {showHistory && !disabled && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                  <span className="text-xs font-medium text-gray-500">
                    최근 검색
                  </span>
                  {searchHistory.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>

                {/* 내용 */}
                <div className="overflow-y-auto max-h-64">
                  {searchHistoryLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <svg
                        className="animate-spin h-4 w-4 text-gray-400 mr-2"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span className="text-xs text-gray-400">
                        불러오는 중...
                      </span>
                    </div>
                  ) : filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-blue-50 cursor-pointer group transition-colors"
                        onClick={() => handleSelectHistory(item.keyword)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* 시계 아이콘 */}
                          <svg
                            className="w-3.5 h-3.5 text-gray-300 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">
                            {item.keyword}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-300 hidden group-hover:inline">
                            {formatRelativeTime(item.searchedAt)}
                          </span>
                          {/* 삭제 버튼 */}
                          <button
                            onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                            className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                            title="삭제"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400">
                      {searchKeyword.trim()
                        ? '일치하는 검색 내역이 없습니다'
                        : '최근 검색 내역이 없습니다'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {isSearchMode && (
            <button
              onClick={() => {
                onClearSearch();
                setShowHistory(false);
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              취소
            </button>
          )}
        </div>

        {/* 우측: 액션 버튼들 */}
        <div className="flex items-center space-x-2">
          {/* 정렬 */}
          <div className="flex items-center space-x-1">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortBy)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={disabled}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => onSortChange(sortBy)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
              disabled={disabled}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* 구분선 */}
          <div className="h-6 w-px bg-gray-300" />

          {/* 뷰 모드 토글 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="그리드 보기"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded ${
                viewMode === 'list'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="목록 보기"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* 구분선 */}
          <div className="h-6 w-px bg-gray-300" />

          {/* 새 폴더 */}
          <button
            onClick={onCreateFolder}
            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            disabled={disabled}
          >
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            새 폴더
          </button>

          {/* 업로드 */}
          <button
            onClick={onUpload}
            className="flex items-center px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg"
            disabled={disabled}
          >
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            업로드
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 상대 시간 포맷 (e.g. "방금", "3분 전", "2시간 전", "어제", "3일 전")
 */
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay === 1) return '어제';
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}
