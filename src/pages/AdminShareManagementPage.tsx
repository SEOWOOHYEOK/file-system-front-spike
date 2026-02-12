/**
 * AdminShareManagementPage - 805.관리자 - 파일 공유 관리 (전체)
 *
 * 사용 API:
 *  GET    /v1/admin/shares                              전체 공유 현황 조회 (필터링 지원)
 *  GET    /v1/admin/shares/:id                          공유 상세 조회
 *  PATCH  /v1/admin/shares/:id/block                    공유 차단
 *  PATCH  /v1/admin/shares/:id/unblock                  차단 해제
 *  GET    /v1/admin/shares/files/:fileId                특정 파일의 공유 목록 조회
 *  PATCH  /v1/admin/shares/files/:fileId/block-all      특정 파일의 모든 공유 일괄 차단
 *  PATCH  /v1/admin/shares/files/:fileId/unblock-all    특정 파일의 모든 공유 일괄 차단 해제
 *  PATCH  /v1/admin/shares/external-users/:userId/block-all  특정 외부 사용자의 모든 공유 일괄 차단
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import {
  adminShareApi,
  type PaginatedResponse,
  type AdminShareListItem,
  type AdminShareDetail,
  type AdminShareFilterQuery,
} from '../api/adminShareApi';

// ─── 유틸 ───

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getMimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📙';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return '📦';
  if (mimeType.startsWith('text/')) return '📝';
  return '📄';
}

// ─── 필터 초기값 ───
interface FilterState {
  ownerName: string;
  ownerDepartment: string;
  recipientName: string;
  recipientDepartment: string;
  fileName: string;
}

const EMPTY_FILTER: FilterState = {
  ownerName: '',
  ownerDepartment: '',
  recipientName: '',
  recipientDepartment: '',
  fileName: '',
};

// ─── 메인 컴포넌트 ───

export function AdminShareManagementPage() {
  const { auth } = useInternalAuth();

  // 리스트
  const [listData, setListData] = useState<PaginatedResponse<AdminShareListItem> | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 필터
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTER);
  const [showFilters, setShowFilters] = useState(false);

  // 상세
  const [detailData, setDetailData] = useState<AdminShareDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 파일별 조회 (인라인 모달)
  const [fileSharesData, setFileSharesData] = useState<{
    fileId: string;
    fileName: string;
    shares: AdminShareDetail[];
  } | null>(null);

  // 로딩 & 메시지
  const [loading, setLoading] = useState({
    list: false,
    detail: false,
    action: false,
    fileShares: false,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── 활성 필터 개수 ──
  const activeFilterCount = Object.values(appliedFilters).filter((v) => v.trim() !== '').length;

  // ── 전체 목록 조회 ──
  const fetchList = useCallback(async () => {
    if (!auth.token) return;
    setLoading((p) => ({ ...p, list: true }));
    try {
      const query: AdminShareFilterQuery = {
        page,
        pageSize: 20,
        sortBy,
        sortOrder,
      };
      // 적용된 필터만 추가
      if (appliedFilters.ownerName.trim()) query.ownerName = appliedFilters.ownerName.trim();
      if (appliedFilters.ownerDepartment.trim()) query.ownerDepartment = appliedFilters.ownerDepartment.trim();
      if (appliedFilters.recipientName.trim()) query.recipientName = appliedFilters.recipientName.trim();
      if (appliedFilters.recipientDepartment.trim()) query.recipientDepartment = appliedFilters.recipientDepartment.trim();
      if (appliedFilters.fileName.trim()) query.fileName = appliedFilters.fileName.trim();

      const data = await adminShareApi.getAll(auth.token, query);
      setListData(data);
    } catch (e) {
      console.error('Failed to fetch shares:', e);
      showMessage('error', e instanceof Error ? e.message : '목록 조회 실패');
    } finally {
      setLoading((p) => ({ ...p, list: false }));
    }
  }, [auth.token, page, sortBy, sortOrder, appliedFilters]);

  // ── 필터 적용 ──
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  // ── 필터 초기화 ──
  const handleResetFilters = () => {
    setFilters(EMPTY_FILTER);
    setAppliedFilters(EMPTY_FILTER);
    setPage(1);
  };

  // ── 필터 input Enter 키 ──
  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApplyFilters();
  };

  // ── 상세 조회 ──
  const fetchDetail = useCallback(
    async (id: string) => {
      if (!auth.token) return;
      setLoading((p) => ({ ...p, detail: true }));
      try {
        const data = await adminShareApi.getById(auth.token, id);
        setDetailData(data);
        setShowDetail(true);
      } catch (e) {
        console.error('Failed to fetch detail:', e);
        showMessage('error', e instanceof Error ? e.message : '상세 조회 실패');
      } finally {
        setLoading((p) => ({ ...p, detail: false }));
      }
    },
    [auth.token],
  );

  // ── 개별 차단 ──
  const handleBlock = useCallback(
    async (id: string) => {
      if (!auth.token) return;
      if (!confirm('이 공유를 차단하시겠습니까?')) return;
      setLoading((p) => ({ ...p, action: true }));
      try {
        await adminShareApi.block(auth.token, id);
        showMessage('success', '공유가 차단되었습니다.');
        if (detailData?.id === id) fetchDetail(id);
        fetchList();
        // 파일별 목록도 갱신
        if (fileSharesData) {
          const updated = await adminShareApi.getByFile(auth.token, fileSharesData.fileId);
          setFileSharesData((prev) => prev ? { ...prev, shares: updated } : null);
        }
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : '차단 실패');
      } finally {
        setLoading((p) => ({ ...p, action: false }));
      }
    },
    [auth.token, detailData, fetchDetail, fetchList, fileSharesData],
  );

  // ── 개별 차단 해제 ──
  const handleUnblock = useCallback(
    async (id: string) => {
      if (!auth.token) return;
      if (!confirm('이 공유의 차단을 해제하시겠습니까?')) return;
      setLoading((p) => ({ ...p, action: true }));
      try {
        await adminShareApi.unblock(auth.token, id);
        showMessage('success', '차단이 해제되었습니다.');
        if (detailData?.id === id) fetchDetail(id);
        fetchList();
        if (fileSharesData) {
          const updated = await adminShareApi.getByFile(auth.token, fileSharesData.fileId);
          setFileSharesData((prev) => prev ? { ...prev, shares: updated } : null);
        }
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : '차단 해제 실패');
      } finally {
        setLoading((p) => ({ ...p, action: false }));
      }
    },
    [auth.token, detailData, fetchDetail, fetchList, fileSharesData],
  );

  // ── 외부 사용자 일괄 차단 (인라인) ──
  const handleBlockAllByExternalUser = useCallback(
    async (userId: string, userName: string) => {
      if (!auth.token) return;
      if (!confirm(`"${userName}" 사용자의 모든 공유를 차단하시겠습니까?`)) return;
      setLoading((p) => ({ ...p, action: true }));
      try {
        const res = await adminShareApi.blockAllByExternalUser(auth.token, userId);
        showMessage('success', `"${userName}"의 공유 ${res.blockedCount}건이 차단되었습니다.`);
        fetchList();
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : '일괄 차단 실패');
      } finally {
        setLoading((p) => ({ ...p, action: false }));
      }
    },
    [auth.token, fetchList],
  );

  // ── 파일별 공유 조회 (인라인 모달) ──
  const handleViewFileShares = useCallback(
    async (fileId: string, fileName: string) => {
      if (!auth.token) return;
      setLoading((p) => ({ ...p, fileShares: true }));
      try {
        const data = await adminShareApi.getByFile(auth.token, fileId);
        setFileSharesData({ fileId, fileName, shares: data });
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : '파일별 공유 조회 실패');
      } finally {
        setLoading((p) => ({ ...p, fileShares: false }));
      }
    },
    [auth.token],
  );

  // ── 파일 일괄 차단 ──
  const handleBlockAllByFile = useCallback(
    async (fileId: string, fileName: string) => {
      if (!auth.token) return;
      if (!confirm(`"${fileName}" 파일의 모든 공유를 차단하시겠습니까?`)) return;
      setLoading((p) => ({ ...p, action: true }));
      try {
        const res = await adminShareApi.blockAllByFile(auth.token, fileId);
        showMessage('success', `"${fileName}" 파일의 공유 ${res.blockedCount}건이 차단되었습니다.`);
        fetchList();
        // 파일별 모달이 열려있으면 갱신
        if (fileSharesData?.fileId === fileId) {
          const updated = await adminShareApi.getByFile(auth.token, fileId);
          setFileSharesData((prev) => prev ? { ...prev, shares: updated } : null);
        }
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : '일괄 차단 실패');
      } finally {
        setLoading((p) => ({ ...p, action: false }));
      }
    },
    [auth.token, fetchList, fileSharesData],
  );

  // ── 파일 일괄 차단 해제 ──
  const handleUnblockAllByFile = useCallback(
    async (fileId: string, fileName: string) => {
      if (!auth.token) return;
      if (!confirm(`"${fileName}" 파일의 모든 공유 차단을 해제하시겠습니까?`)) return;
      setLoading((p) => ({ ...p, action: true }));
      try {
        const res = await adminShareApi.unblockAllByFile(auth.token, fileId);
        showMessage('success', `"${fileName}" 파일의 차단 ${res.unblockedCount}건이 해제되었습니다.`);
        fetchList();
        if (fileSharesData?.fileId === fileId) {
          const updated = await adminShareApi.getByFile(auth.token, fileId);
          setFileSharesData((prev) => prev ? { ...prev, shares: updated } : null);
        }
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : '일괄 차단 해제 실패');
      } finally {
        setLoading((p) => ({ ...p, action: false }));
      }
    },
    [auth.token, fetchList, fileSharesData],
  );

  // ── 메시지 표시 ──
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── 초기 로드 ──
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchList();
    }
  }, [auth.isAuthenticated, fetchList]);

  // ── 인증 체크 ──
  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* ── 헤더 ── */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔗</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">파일 공유 관리 (전체 805)</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              시스템 내 전체 파일 공유 현황을 관리합니다. 필터링, 차단/해제, 일괄 작업을 수행할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 토스트 메시지 ── */}
      {message && (
        <div
          className={`mx-6 mt-3 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ── 필터/검색 바 ── */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-3">
          {/* 필터 토글 버튼 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors border ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            필터
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-blue-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt">생성일</option>
              <option value="fileName">파일명</option>
              <option value="ownerName">공유자</option>
              <option value="recipientName">수신자</option>
              <option value="isBlocked">차단상태</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as 'asc' | 'desc');
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">내림차순</option>
              <option value="asc">오름차순</option>
            </select>
          </div>

          <div className="flex-1" />

          {/* 활성 필터 태그 */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5">
              {appliedFilters.ownerName && (
                <FilterTag label="공유자" value={appliedFilters.ownerName} />
              )}
              {appliedFilters.ownerDepartment && (
                <FilterTag label="공유자부서" value={appliedFilters.ownerDepartment} />
              )}
              {appliedFilters.recipientName && (
                <FilterTag label="수신자" value={appliedFilters.recipientName} />
              )}
              {appliedFilters.recipientDepartment && (
                <FilterTag label="수신자부서" value={appliedFilters.recipientDepartment} />
              )}
              {appliedFilters.fileName && (
                <FilterTag label="파일명" value={appliedFilters.fileName} />
              )}
              <button
                onClick={handleResetFilters}
                className="px-2 py-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
                title="필터 초기화"
              >
                초기화
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setPage(1);
              fetchList();
            }}
            className="px-4 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>

        {/* 필터 패널 (접기/펼치기) */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">공유자 이름</label>
                <input
                  type="text"
                  value={filters.ownerName}
                  onChange={(e) => setFilters((p) => ({ ...p, ownerName: e.target.value }))}
                  onKeyDown={handleFilterKeyDown}
                  placeholder="홍길동"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">공유자 부서</label>
                <input
                  type="text"
                  value={filters.ownerDepartment}
                  onChange={(e) => setFilters((p) => ({ ...p, ownerDepartment: e.target.value }))}
                  onKeyDown={handleFilterKeyDown}
                  placeholder="개발팀"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">수신자 이름</label>
                <input
                  type="text"
                  value={filters.recipientName}
                  onChange={(e) => setFilters((p) => ({ ...p, recipientName: e.target.value }))}
                  onKeyDown={handleFilterKeyDown}
                  placeholder="김철수"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">수신자 소속/부서</label>
                <input
                  type="text"
                  value={filters.recipientDepartment}
                  onChange={(e) => setFilters((p) => ({ ...p, recipientDepartment: e.target.value }))}
                  onKeyDown={handleFilterKeyDown}
                  placeholder="협력업체A"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">파일명</label>
                <input
                  type="text"
                  value={filters.fileName}
                  onChange={(e) => setFilters((p) => ({ ...p, fileName: e.target.value }))}
                  onKeyDown={handleFilterKeyDown}
                  placeholder="설계문서"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={handleResetFilters}
                className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                초기화
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                검색
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 본문 영역 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* === 메인 테이블 === */}
        <div className={`flex-1 overflow-auto ${showDetail ? 'border-r' : ''}`}>
          {loading.list ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
              <span className="ml-2 text-gray-500">목록 로딩 중...</span>
            </div>
          ) : listData && listData.items.length > 0 ? (
            <>
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      공유자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      파일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      외부 사용자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      권한
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      조회/다운로드
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      만료일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      생성일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {listData.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => fetchDetail(item.id)}
                    >
                      <td className="px-4 py-3">
                        <ShareStatusBadge
                          isBlocked={item.isBlocked}
                          isRevoked={item.isRevoked}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {item.ownerName || '-'}
                          </div>
                          {item.ownerDepartment && (
                            <div className="text-xs text-gray-400">{item.ownerDepartment}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-base" title={item.fileInfo.mimeType}>
                            {getMimeIcon(item.fileInfo.mimeType)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => handleViewFileShares(item.fileInfo.fileId, item.fileInfo.fileName)}
                              className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline truncate max-w-[180px] block text-left"
                              title={`${item.fileInfo.fileName} - 클릭하면 이 파일의 모든 공유를 조회합니다`}
                            >
                              {item.fileInfo.fileName}
                            </button>
                            <div className="text-xs text-gray-400">
                              {formatFileSize(item.fileInfo.fileSize)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                          <ExternalUserCell
                            user={item.externalUser}
                            onBlockAll={handleBlockAllByExternalUser}
                            actionLoading={loading.action}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {item.permissions.map((p) => (
                            <span
                              key={p}
                              className={`px-2 py-0.5 text-xs rounded ${
                                p === 'VIEW'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {p === 'VIEW' ? '열람' : '다운로드'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.currentViewCount} / {item.currentDownloadCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {item.expiresAt ? formatDate(item.expiresAt) : (
                          <span className="text-gray-300">무기한</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {!item.isBlocked && !item.isRevoked && (
                            <button
                              onClick={() => handleBlock(item.id)}
                              disabled={loading.action}
                              className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              차단
                            </button>
                          )}
                          {item.isBlocked && (
                            <button
                              onClick={() => handleUnblock(item.id)}
                              disabled={loading.action}
                              className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              해제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between px-6 py-3 border-t bg-white sticky bottom-0">
                <div className="text-sm text-gray-500">
                  총 {listData.totalItems.toLocaleString()}건 중{' '}
                  {((page - 1) * 20 + 1).toLocaleString()}-
                  {Math.min(page * 20, listData.totalItems).toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!listData.hasPrev}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-700 px-2">
                    {page} / {listData.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!listData.hasNext}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-4xl mb-3">🔗</span>
              {activeFilterCount > 0 ? (
                <>
                  <p>검색 조건에 맞는 공유가 없습니다.</p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    필터 초기화
                  </button>
                </>
              ) : (
                <p>공유 데이터가 없습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {showDetail && detailData && (
          <DetailPanel
            data={detailData}
            loading={loading.detail}
            onClose={() => {
              setShowDetail(false);
              setDetailData(null);
            }}
            onBlock={handleBlock}
            onUnblock={handleUnblock}
            onBlockAllByFile={handleBlockAllByFile}
            onBlockAllByExternalUser={handleBlockAllByExternalUser}
            onViewFileShares={handleViewFileShares}
            actionLoading={loading.action}
          />
        )}
      </div>

      {/* ── 파일별 공유 모달 ── */}
      {fileSharesData && (
        <FileSharesModal
          data={fileSharesData}
          loading={loading.fileShares}
          actionLoading={loading.action}
          onClose={() => setFileSharesData(null)}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onBlockAll={handleBlockAllByFile}
          onUnblockAll={handleUnblockAllByFile}
          onBlockAllByExternalUser={handleBlockAllByExternalUser}
        />
      )}
    </div>
  );
}

// ─── 서브 컴포넌트들 ───

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-blue-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/** 필터 태그 */
function FilterTag({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
      <span className="text-blue-400">{label}:</span>
      {value}
    </span>
  );
}

/** 공유 상태 뱃지 */
function ShareStatusBadge({ isBlocked, isRevoked }: { isBlocked: boolean; isRevoked: boolean }) {
  if (isRevoked) {
    return (
      <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
        취소됨
      </span>
    );
  }
  if (isBlocked) {
    return (
      <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700">
        차단됨
      </span>
    );
  }
  return (
    <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
      활성
    </span>
  );
}

/** 외부 사용자 셀 (드롭다운 메뉴 포함) */
function ExternalUserCell({
  user,
  onBlockAll,
  actionLoading,
}: {
  user: AdminShareListItem['externalUser'];
  onBlockAll: (userId: string, userName: string) => void;
  actionLoading: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="text-left group"
        title="클릭하면 일괄 차단 메뉴가 열립니다"
      >
        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
          {user.name}
          <svg className="w-3 h-3 inline-block ml-1 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="text-xs text-gray-400 truncate max-w-[160px]">
          {[user.company, user.department].filter(Boolean).join(' · ') || '-'}
        </div>
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[200px]">
          <div className="px-3 py-2 border-b bg-gray-50 rounded-t-lg">
            <div className="text-xs font-medium text-gray-700">{user.name}</div>
            <div className="text-xs text-gray-400">
              {[user.company, user.department].filter(Boolean).join(' · ') || '-'}
            </div>
            <div className="text-xs text-gray-300 mt-0.5 font-mono">
              {user.externalUserId.slice(0, 8)}...
            </div>
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                onBlockAll(user.externalUserId, user.name);
                setShowMenu(false);
              }}
              disabled={actionLoading}
              className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              이 사용자의 모든 공유 차단
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 파일별 공유 목록 모달 */
function FileSharesModal({
  data,
  loading: isLoading,
  actionLoading,
  onClose,
  onBlock,
  onUnblock,
  onBlockAll,
  onUnblockAll,
  onBlockAllByExternalUser,
}: {
  data: { fileId: string; fileName: string; shares: AdminShareDetail[] };
  loading: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
  onBlockAll: (fileId: string, fileName: string) => void;
  onUnblockAll: (fileId: string, fileName: string) => void;
  onBlockAllByExternalUser: (userId: string, userName: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {data.shares[0] ? getMimeIcon(data.shares[0].fileInfo.mimeType) : '📄'}
            </span>
            <div>
              <h3 className="font-semibold text-gray-900">{data.fileName}</h3>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                파일 ID: {data.fileId.slice(0, 12)}...
              </div>
            </div>
            <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
              {data.shares.length}건
            </span>
          </div>
          <div className="flex items-center gap-2">
            {data.shares.length > 0 && (
              <>
                <button
                  onClick={() => onBlockAll(data.fileId, data.fileName)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  전체 차단
                </button>
                <button
                  onClick={() => onUnblockAll(data.fileId, data.fileName)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  전체 해제
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors ml-2"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 모달 본문 */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner />
              <span className="ml-2 text-gray-500">조회 중...</span>
            </div>
          ) : data.shares.length > 0 ? (
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">외부 사용자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">권한</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">조회/다운</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">만료일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.shares.map((share) => (
                  <tr key={share.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <ShareStatusBadge isBlocked={share.isBlocked} isRevoked={share.isRevoked} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">{share.externalUser.name}</span>
                          <button
                            onClick={() => onBlockAllByExternalUser(share.externalUser.externalUserId, share.externalUser.name)}
                            disabled={actionLoading}
                            className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                            title={`${share.externalUser.name}의 모든 공유 차단`}
                          >
                            일괄차단
                          </button>
                        </div>
                        <div className="text-xs text-gray-400">
                          {[share.externalUser.company, share.externalUser.department].filter(Boolean).join(' · ') || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {share.permissions.map((p) => (
                          <span
                            key={p}
                            className={`px-2 py-0.5 text-xs rounded ${
                              p === 'VIEW'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {p === 'VIEW' ? '열람' : '다운로드'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="text-xs">
                        <span>뷰 {share.currentViewCount}{share.maxViewCount != null ? `/${share.maxViewCount}` : ''}</span>
                        <span className="mx-1">·</span>
                        <span>다운 {share.currentDownloadCount}{share.maxDownloadCount != null ? `/${share.maxDownloadCount}` : ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {share.expiresAt ? formatDate(share.expiresAt) : '무기한'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(share.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1">
                        {!share.isBlocked && !share.isRevoked && (
                          <button
                            onClick={() => onBlock(share.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            차단
                          </button>
                        )}
                        {share.isBlocked && (
                          <button
                            onClick={() => onUnblock(share.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            해제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p className="text-sm">해당 파일에 대한 공유가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 상세 패널 */
function DetailPanel({
  data,
  loading: isLoading,
  onClose,
  onBlock,
  onUnblock,
  onBlockAllByFile,
  onBlockAllByExternalUser,
  onViewFileShares,
  actionLoading,
}: {
  data: AdminShareDetail;
  loading: boolean;
  onClose: () => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
  onBlockAllByFile: (fileId: string, fileName: string) => void;
  onBlockAllByExternalUser: (userId: string, userName: string) => void;
  onViewFileShares: (fileId: string, fileName: string) => void;
  actionLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="w-[440px] bg-white flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="w-[440px] bg-white overflow-auto">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between z-10">
        <h3 className="font-semibold text-gray-900">공유 상세</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* 상태 & 작업 */}
        <Section label="상태">
          <div className="flex items-center gap-3">
            <ShareStatusBadge isBlocked={data.isBlocked} isRevoked={data.isRevoked} />
            {!data.isRevoked && (
              <>
                {!data.isBlocked ? (
                  <button
                    onClick={() => onBlock(data.id)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    차단하기
                  </button>
                ) : (
                  <button
                    onClick={() => onUnblock(data.id)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                  >
                    차단 해제
                  </button>
                )}
              </>
            )}
          </div>
        </Section>

        {/* 파일 정보 */}
        <Section label="파일 정보">
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getMimeIcon(data.fileInfo.mimeType)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 break-all">{data.fileInfo.fileName}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {formatFileSize(data.fileInfo.fileSize)} · {data.fileInfo.mimeType}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-gray-200">
              <div>
                <span className="text-gray-400">파일 ID:</span>{' '}
                <span className="font-mono">{data.fileInfo.fileId.slice(0, 8)}...</span>
              </div>
              <div>
                <span className="text-gray-400">업로더:</span>{' '}
                <span className="font-mono">{data.fileInfo.createdBy.slice(0, 8)}...</span>
              </div>
            </div>
            {/* 파일 관련 일괄 작업 */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => onViewFileShares(data.fileInfo.fileId, data.fileInfo.fileName)}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
              >
                이 파일의 전체 공유 보기
              </button>
              <button
                onClick={() => onBlockAllByFile(data.fileInfo.fileId, data.fileInfo.fileName)}
                disabled={actionLoading}
                className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                이 파일 전체 차단
              </button>
            </div>
          </div>
        </Section>

        {/* 외부 사용자 정보 */}
        <Section label="외부 사용자">
          <div className="p-3 bg-gray-50 rounded-lg space-y-1.5">
            <div className="text-sm font-semibold text-gray-900">{data.externalUser.name}</div>
            {(data.externalUser.company || data.externalUser.department) && (
              <div className="text-xs text-gray-500">
                {[data.externalUser.company, data.externalUser.department].filter(Boolean).join(' · ')}
              </div>
            )}
            <div className="text-xs text-gray-400 pt-1 border-t border-gray-200">
              <span className="text-gray-400">사용자 ID:</span>{' '}
              <span className="font-mono">{data.externalUser.externalUserId.slice(0, 8)}...</span>
            </div>
            {/* 외부 사용자 일괄 차단 */}
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => onBlockAllByExternalUser(data.externalUser.externalUserId, data.externalUser.name)}
                disabled={actionLoading}
                className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                이 사용자의 모든 공유 차단
              </button>
            </div>
          </div>
        </Section>

        {/* 소유자(공유자) ID */}
        <Section label="공유자 ID">
          <div className="text-sm font-mono text-gray-700 bg-gray-50 p-2.5 rounded-lg break-all">
            {data.ownerId}
          </div>
        </Section>

        {/* 권한 */}
        <Section label="권한">
          <div className="flex flex-wrap gap-1.5">
            {data.permissions.map((p) => (
              <span
                key={p}
                className={`px-2.5 py-1 text-xs font-medium rounded ${
                  p === 'VIEW' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'
                }`}
              >
                {p === 'VIEW' ? '열람(VIEW)' : '다운로드(DOWNLOAD)'}
              </span>
            ))}
          </div>
        </Section>

        {/* 사용량 */}
        <Section label="사용량">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600 font-medium">뷰 횟수</div>
              <div className="text-lg font-bold text-blue-800 mt-1">
                {data.currentViewCount}
                {data.maxViewCount != null && (
                  <span className="text-sm font-normal text-blue-500"> / {data.maxViewCount}</span>
                )}
              </div>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <div className="text-xs text-indigo-600 font-medium">다운로드 횟수</div>
              <div className="text-lg font-bold text-indigo-800 mt-1">
                {data.currentDownloadCount}
                {data.maxDownloadCount != null && (
                  <span className="text-sm font-normal text-indigo-500"> / {data.maxDownloadCount}</span>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* 만료일 */}
        <Section label="만료일">
          <div className="text-sm text-gray-700">
            {data.expiresAt ? formatDateTime(data.expiresAt) : '무기한'}
          </div>
        </Section>

        {/* 차단 정보 */}
        {data.isBlocked && (
          <Section label="차단 정보">
            <div className="p-3 bg-red-50 rounded-lg space-y-1.5">
              {data.blockedAt && (
                <div className="text-sm text-red-700">
                  <span className="font-medium">차단일시:</span> {formatDateTime(data.blockedAt)}
                </div>
              )}
              {data.blockedBy && (
                <div className="text-sm text-red-700">
                  <span className="font-medium">차단자:</span>{' '}
                  <span className="font-mono">{data.blockedBy.slice(0, 8)}...</span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 공유 ID */}
        <Section label="공유 ID">
          <div className="text-xs font-mono text-gray-500 bg-gray-50 p-2.5 rounded-lg break-all">
            {data.id}
          </div>
        </Section>

        {/* 생성일 */}
        <Section label="생성일">
          <div className="text-sm text-gray-700">{formatDateTime(data.createdAt)}</div>
        </Section>

        {/* 수정일 */}
        {data.updatedAt && (
          <Section label="수정일">
            <div className="text-sm text-gray-700">{formatDateTime(data.updatedAt)}</div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
