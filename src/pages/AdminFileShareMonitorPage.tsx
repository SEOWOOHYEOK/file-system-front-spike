/**
 * AdminFileShareMonitorPage - 807.파일 결제 관리(모니터링)
 * GET API만 사용하여 공유 요청 현황을 조회·모니터링하는 읽기 전용 페이지
 *
 * 사용 API:
 *  A-1: GET /v1/admin/file-shares-requests/summary     (상태별 카운트)
 *  A-2: GET /v1/admin/file-shares-requests              (목록 조회)
 *  A-3: GET /v1/admin/file-shares-requests/:id          (상세 조회)
 *  Q-1: GET /v1/admin/file-shares-requests/by-target/:userId (대상자별)
 *  Q-2: GET /v1/admin/file-shares-requests/by-file/:fileId   (파일별)
 *  Q-3: GET /v1/admin/file-shares-requests/files        (파일별 전체 목록 그룹핑)
 *  Q-4: GET /v1/admin/file-shares-requests/targets      (대상자별 전체 목록 그룹핑)
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import {
  adminFileShareRequestApi,
  type ShareRequestStatus,
  type FileShareRequestSummary,
  type FileShareRequestItem,
  type FileShareRequestDetail,
  type EnrichedShareTarget,
  type PaginatedResponse,
  type SharesByTargetResponse,
  type SharesByFileResponse,
  type ShareItemResult,
  type GroupListQuery,
  type FileGroupItem,
  type FileGroupListResponse,
  type TargetGroupItem,
  type TargetGroupListResponse,
  type ShareRequestBrief,
  type GroupSummary,
  type ExternalUserDetail,
} from '../api/adminFileShareRequestApi';

// ─── 상수 ───

const STATUS_MAP: Record<
  ShareRequestStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  PENDING: { label: '대기 중', color: 'text-amber-800', bg: 'bg-amber-50', icon: '⏳' },
  APPROVED: { label: '승인', color: 'text-emerald-800', bg: 'bg-emerald-50', icon: '✅' },
  REJECTED: { label: '반려', color: 'text-red-800', bg: 'bg-red-50', icon: '❌' },
  CANCELED: { label: '취소', color: 'text-gray-700', bg: 'bg-gray-50', icon: '🚫' },
};

const STATUS_BORDER: Record<ShareRequestStatus, string> = {
  PENDING: 'border-amber-400',
  APPROVED: 'border-emerald-400',
  REJECTED: 'border-red-400',
  CANCELED: 'border-gray-300',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── 서브 쿼리 탭 ───
type SubQueryTab = 'list' | 'byTarget' | 'byFile' | 'fileGroupList' | 'targetGroupList';

// ─── 메인 컴포넌트 ───

export function AdminFileShareMonitorPage() {
  const { auth } = useInternalAuth();

  // 상태
  const [summary, setSummary] = useState<FileShareRequestSummary | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ShareRequestStatus>('PENDING');
  const [listData, setListData] = useState<PaginatedResponse<FileShareRequestItem> | null>(null);
  const [detailData, setDetailData] = useState<FileShareRequestDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 검색
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // 서브 쿼리 상태
  const [subTab, setSubTab] = useState<SubQueryTab>('list');
  const [targetUserId, setTargetUserId] = useState('');
  const [fileId, setFileId] = useState('');
  const [targetData, setTargetData] = useState<SharesByTargetResponse | null>(null);
  const [fileData, setFileData] = useState<SharesByFileResponse | null>(null);
  const [subPage, setSubPage] = useState(1);

  // Q-3: 파일별 전체 목록 상태
  const [fileGroupData, setFileGroupData] = useState<FileGroupListResponse | null>(null);
  const [fileGroupQuery, setFileGroupQuery] = useState('');
  const [fileGroupStatus, setFileGroupStatus] = useState<ShareRequestStatus | ''>('');
  const [fileGroupPage, setFileGroupPage] = useState(1);
  const [fileGroupSortBy, setFileGroupSortBy] = useState('latestRequestedAt');
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());

  // Q-4: 대상자별 전체 목록 상태
  const [targetGroupData, setTargetGroupData] = useState<TargetGroupListResponse | null>(null);
  const [targetGroupQuery, setTargetGroupQuery] = useState('');
  const [targetGroupStatus, setTargetGroupStatus] = useState<ShareRequestStatus | ''>('');
  const [targetGroupPage, setTargetGroupPage] = useState(1);
  const [targetGroupSortBy, setTargetGroupSortBy] = useState('latestRequestedAt');
  const [expandedTargetIds, setExpandedTargetIds] = useState<Set<string>>(new Set());

  // 로딩
  const [loading, setLoading] = useState({
    summary: false,
    list: false,
    detail: false,
    sub: false,
  });

  // ── A-1: 요약 카운트 조회 ──
  const fetchSummary = useCallback(async () => {
    if (!auth.token) return;
    setLoading((p) => ({ ...p, summary: true }));
    try {
      const data = await adminFileShareRequestApi.getSummary(auth.token);
      setSummary(data);
    } catch (e) {
      console.error('Failed to fetch summary:', e);
    } finally {
      setLoading((p) => ({ ...p, summary: false }));
    }
  }, [auth.token]);

  // ── A-2: 목록 조회 ──
  const fetchList = useCallback(async () => {
    if (!auth.token) return;
    setLoading((p) => ({ ...p, list: true }));
    try {
      const data = await adminFileShareRequestApi.getList(auth.token, {
        status: currentStatus,
        q: searchQuery || undefined,
        page,
        pageSize: 20,
        sort: 'requestedAt,desc',
      });
      setListData(data);
    } catch (e) {
      console.error('Failed to fetch list:', e);
    } finally {
      setLoading((p) => ({ ...p, list: false }));
    }
  }, [auth.token, currentStatus, searchQuery, page]);

  // ── A-3: 상세 조회 ──
  const fetchDetail = useCallback(
    async (id: string) => {
      if (!auth.token) return;
      setLoading((p) => ({ ...p, detail: true }));
      try {
        const data = await adminFileShareRequestApi.getDetail(auth.token, id);
        setDetailData(data);
        setShowDetail(true);
      } catch (e) {
        console.error('Failed to fetch detail:', e);
      } finally {
        setLoading((p) => ({ ...p, detail: false }));
      }
    },
    [auth.token],
  );

  // ── Q-1: 대상자별 공유 조회 ──
  const fetchByTarget = useCallback(async () => {
    if (!auth.token || !targetUserId.trim()) return;
    setLoading((p) => ({ ...p, sub: true }));
    try {
      const data = await adminFileShareRequestApi.getByTarget(auth.token, targetUserId.trim(), {
        page: subPage,
        pageSize: 20,
      });
      setTargetData(data);
    } catch (e) {
      console.error('Failed to fetch by target:', e);
    } finally {
      setLoading((p) => ({ ...p, sub: false }));
    }
  }, [auth.token, targetUserId, subPage]);

  // ── Q-2: 파일별 공유 조회 ──
  const fetchByFile = useCallback(async () => {
    if (!auth.token || !fileId.trim()) return;
    setLoading((p) => ({ ...p, sub: true }));
    try {
      const data = await adminFileShareRequestApi.getByFile(auth.token, fileId.trim(), {
        page: subPage,
        pageSize: 20,
      });
      setFileData(data);
    } catch (e) {
      console.error('Failed to fetch by file:', e);
    } finally {
      setLoading((p) => ({ ...p, sub: false }));
    }
  }, [auth.token, fileId, subPage]);

  // ── Q-3: 파일별 전체 목록 조회 ──
  const fetchFileGroupList = useCallback(async () => {
    if (!auth.token) return;
    setLoading((p) => ({ ...p, sub: true }));
    try {
      const query: GroupListQuery = {
        page: fileGroupPage,
        pageSize: 20,
        sortBy: fileGroupSortBy,
        sortOrder: 'desc',
      };
      if (fileGroupStatus) query.status = fileGroupStatus as ShareRequestStatus;
      if (fileGroupQuery) query.q = fileGroupQuery;
      const data = await adminFileShareRequestApi.getFileGroupList(auth.token, query);
      setFileGroupData(data);
    } catch (e) {
      console.error('Failed to fetch file group list:', e);
    } finally {
      setLoading((p) => ({ ...p, sub: false }));
    }
  }, [auth.token, fileGroupPage, fileGroupSortBy, fileGroupStatus, fileGroupQuery]);

  // ── Q-4: 대상자별 전체 목록 조회 ──
  const fetchTargetGroupList = useCallback(async () => {
    if (!auth.token) return;
    setLoading((p) => ({ ...p, sub: true }));
    try {
      const query: GroupListQuery = {
        page: targetGroupPage,
        pageSize: 20,
        sortBy: targetGroupSortBy,
        sortOrder: 'desc',
      };
      if (targetGroupStatus) query.status = targetGroupStatus as ShareRequestStatus;
      if (targetGroupQuery) query.q = targetGroupQuery;
      const data = await adminFileShareRequestApi.getTargetGroupList(auth.token, query);
      setTargetGroupData(data);
    } catch (e) {
      console.error('Failed to fetch target group list:', e);
    } finally {
      setLoading((p) => ({ ...p, sub: false }));
    }
  }, [auth.token, targetGroupPage, targetGroupSortBy, targetGroupStatus, targetGroupQuery]);

  // ── 상태 탭 변경 ──
  const handleStatusChange = (status: ShareRequestStatus) => {
    setCurrentStatus(status);
    setPage(1);
    setShowDetail(false);
    setDetailData(null);
  };

  // ── 서브 탭 변경 ──
  const handleSubTabChange = (tab: SubQueryTab) => {
    setSubTab(tab);
    setSubPage(1);
    setTargetData(null);
    setFileData(null);
    setFileGroupData(null);
    setTargetGroupData(null);
    setExpandedFileIds(new Set());
    setExpandedTargetIds(new Set());
    setShowDetail(false);
    setDetailData(null);
  };

  // ── 초기 로드 ──
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchSummary();
    }
  }, [auth.isAuthenticated, fetchSummary]);

  useEffect(() => {
    if (auth.isAuthenticated && subTab === 'list') {
      fetchList();
    }
  }, [auth.isAuthenticated, fetchList, subTab]);

  useEffect(() => {
    if (auth.isAuthenticated && subTab === 'fileGroupList') {
      fetchFileGroupList();
    }
  }, [auth.isAuthenticated, fetchFileGroupList, subTab]);

  useEffect(() => {
    if (auth.isAuthenticated && subTab === 'targetGroupList') {
      fetchTargetGroupList();
    }
  }, [auth.isAuthenticated, fetchTargetGroupList, subTab]);

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
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">파일 결제 관리 (모니터링 807)</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              공유 요청 현황을 조회하고 모니터링합니다. (읽기 전용)
            </p>
          </div>
        </div>
      </div>

      {/* ── 요약 카드 (A-1) ── */}
      <div className="bg-white border-b px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {(
            Object.entries(STATUS_MAP) as [
              ShareRequestStatus,
              (typeof STATUS_MAP)[ShareRequestStatus],
            ][]
          ).map(([status, config]) => {
            const count = summary?.[status] ?? 0;
            const isActive = currentStatus === status && subTab === 'list';
            return (
              <button
                key={status}
                onClick={() => {
                  handleStatusChange(status);
                  setSubTab('list');
                }}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? `${STATUS_BORDER[status]} ${config.bg} shadow-sm`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{config.label}</span>
                  <span className="text-lg">{config.icon}</span>
                </div>
                <div className="text-3xl font-bold mt-2">
                  {loading.summary ? (
                    <span className="inline-block w-10 h-8 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    count.toLocaleString()
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 서브 탭 (목록 / 대상자별 / 파일별 / 파일별 전체 / 대상자별 전체) ── */}
      <div className="bg-white border-b px-6 py-2 flex items-center gap-1">
        {([
          { key: 'list' as SubQueryTab, label: '📋 상태별 목록' },
          { key: 'fileGroupList' as SubQueryTab, label: '📁 파일별 목록' },
          { key: 'targetGroupList' as SubQueryTab, label: '👥 대상자별 목록' },
          { key: 'byTarget' as SubQueryTab, label: '👤 대상자별 조회' },
          { key: 'byFile' as SubQueryTab, label: '📄 파일별 조회' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleSubTabChange(tab.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              subTab === tab.key
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 검색 바 ── */}
      {subTab === 'list' && (
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchList();
                }
              }}
              placeholder="파일명, 요청자명, 대상자명 검색"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>
          <button
            onClick={() => {
              setPage(1);
              fetchList();
            }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            검색
          </button>
          <button
            onClick={() => fetchSummary()}
            className="px-4 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
      )}

      {/* ── 서브 쿼리 입력 (대상자별) ── */}
      {subTab === 'byTarget' && (
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">사용자 ID:</label>
          <input
            type="text"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSubPage(1);
                fetchByTarget();
              }
            }}
            placeholder="UUID 입력 (예: 550e8400-e29b-...)"
            className="flex-1 max-w-lg px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              setSubPage(1);
              fetchByTarget();
            }}
            disabled={!targetUserId.trim()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            조회
          </button>
        </div>
      )}

      {/* ── 서브 쿼리 입력 (파일별) ── */}
      {subTab === 'byFile' && (
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">파일 ID:</label>
          <input
            type="text"
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSubPage(1);
                fetchByFile();
              }
            }}
            placeholder="UUID 입력 (예: 550e8400-e29b-...)"
            className="flex-1 max-w-lg px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              setSubPage(1);
              fetchByFile();
            }}
            disabled={!fileId.trim()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            조회
          </button>
        </div>
      )}

      {/* ── 검색/필터 바 (Q-3 파일별 전체 목록) ── */}
      {subTab === 'fileGroupList' && (
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={fileGroupQuery}
              onChange={(e) => setFileGroupQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFileGroupPage(1);
                  fetchFileGroupList();
                }
              }}
              placeholder="파일명 검색"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={fileGroupStatus}
            onChange={(e) => {
              setFileGroupStatus(e.target.value as ShareRequestStatus | '');
              setFileGroupPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 상태</option>
            <option value="PENDING">대기 중</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
            <option value="CANCELED">취소</option>
          </select>
          <select
            value={fileGroupSortBy}
            onChange={(e) => {
              setFileGroupSortBy(e.target.value);
              setFileGroupPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="latestRequestedAt">최근 요청일순</option>
            <option value="fileName">파일명순</option>
            <option value="requestCount">요청 건수순</option>
          </select>
          <button
            onClick={() => { setFileGroupPage(1); fetchFileGroupList(); }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            검색
          </button>
          <button
            onClick={() => fetchFileGroupList()}
            className="px-4 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
      )}

      {/* ── 검색/필터 바 (Q-4 대상자별 전체 목록) ── */}
      {subTab === 'targetGroupList' && (
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={targetGroupQuery}
              onChange={(e) => setTargetGroupQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setTargetGroupPage(1);
                  fetchTargetGroupList();
                }
              }}
              placeholder="대상자 이름/이메일 검색"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={targetGroupStatus}
            onChange={(e) => {
              setTargetGroupStatus(e.target.value as ShareRequestStatus | '');
              setTargetGroupPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 상태</option>
            <option value="PENDING">대기 중</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
            <option value="CANCELED">취소</option>
          </select>
          <select
            value={targetGroupSortBy}
            onChange={(e) => {
              setTargetGroupSortBy(e.target.value);
              setTargetGroupPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="latestRequestedAt">최근 요청일순</option>
            <option value="targetName">대상자명순</option>
            <option value="requestCount">요청 건수순</option>
          </select>
          <button
            onClick={() => { setTargetGroupPage(1); fetchTargetGroupList(); }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            검색
          </button>
          <button
            onClick={() => fetchTargetGroupList()}
            className="px-4 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
      )}

      {/* ── 본문 영역 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* === 상태별 목록 === */}
        {subTab === 'list' && (
          <>
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
                          요청자
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          파일
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          대상
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          권한
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          공유 기간
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          요청일
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          자동승인
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {listData.items.map((item) => {
                        const st = STATUS_MAP[item.status];
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                            onClick={() => fetchDetail(item.id)}
                          >
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${st.bg} ${st.color}`}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.requesterDetail ? (
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {item.requesterDetail.name}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {item.requesterDetail.department}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">
                                  {item.requesterId.slice(0, 8)}...
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.files && item.files.length > 0 ? (
                                <div>
                                  <div className="font-medium text-gray-900 truncate max-w-[180px]">
                                    {item.files[0].name}
                                  </div>
                                  {item.files.length > 1 && (
                                    <span className="text-gray-500 text-xs">
                                      외 {item.files.length - 1}개
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">{item.fileIds.length}개 파일</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex flex-wrap gap-1">
                                {(item.targetDetails ?? item.targets).slice(0, 2).map((t, i) => {
                                  const enriched = t as EnrichedShareTarget;
                                  const detail = enriched.userDetail ?? null;
                                  const isInternal = t.type === 'INTERNAL_USER';
                                  return (
                                    <span
                                      key={i}
                                      className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${
                                        isInternal
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-purple-50 text-purple-700'
                                      }`}
                                    >
                                      {detail ? detail.name : isInternal ? '내부' : '외부'}
                                    </span>
                                  );
                                })}
                                {item.targets.length > 2 && (
                                  <span className="text-xs text-gray-400">
                                    +{item.targets.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  item.permission.type === 'VIEW'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {item.permission.type === 'VIEW' ? '열람' : '다운로드'}
                                {item.permission.maxDownloads
                                  ? ` (${item.permission.maxDownloads}회)`
                                  : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {formatDate(item.startAt)} ~ {formatDate(item.endAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {formatDateTime(item.requestedAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              {item.isAutoApproved ? (
                                <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                  자동
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                  <span className="text-4xl mb-3">{STATUS_MAP[currentStatus].icon}</span>
                  <p>{STATUS_MAP[currentStatus].label} 상태의 공유 요청이 없습니다.</p>
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
              />
            )}
          </>
        )}

        {/* === 대상자별 조회 (Q-1) === */}
        {subTab === 'byTarget' && (
          <div className="flex-1 overflow-auto">
            {loading.sub ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
                <span className="ml-2 text-gray-500">조회 중...</span>
              </div>
            ) : targetData ? (
              <div className="p-6 space-y-6">
                {/* 대상자 정보 */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                    대상자 정보
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold">
                      {targetData.target.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{targetData.target.name}</div>
                      <div className="text-sm text-gray-500">{targetData.target.email}</div>
                      <div className="text-xs text-gray-400">
                        {targetData.target.type === 'INTERNAL_USER'
                          ? `내부 · ${'department' in targetData.target ? targetData.target.department : ''}`
                          : `외부 · ${'company' in targetData.target ? targetData.target.company || '' : ''}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 요약 통계 */}
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="활성 공유" value={targetData.summary.activeShareCount} color="emerald" />
                  <StatCard label="대기 요청" value={targetData.summary.pendingRequestCount} color="amber" />
                  <StatCard label="총 조회수" value={targetData.summary.totalViewCount} color="blue" />
                  <StatCard label="총 다운로드" value={targetData.summary.totalDownloadCount} color="indigo" />
                </div>

                {/* 아이템 목록 */}
                <ShareItemTable
                  items={targetData.items}
                  page={subPage}
                  totalItems={targetData.totalItems}
                  totalPages={targetData.totalPages}
                  hasNext={targetData.hasNext}
                  hasPrev={targetData.hasPrev}
                  onPageChange={setSubPage}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <span className="text-5xl mb-3">👤</span>
                <p className="text-sm">사용자 ID를 입력하고 조회 버튼을 클릭하세요.</p>
              </div>
            )}
          </div>
        )}

        {/* === 파일별 조회 (Q-2) === */}
        {subTab === 'byFile' && (
          <div className="flex-1 overflow-auto">
            {loading.sub ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
                <span className="ml-2 text-gray-500">조회 중...</span>
              </div>
            ) : fileData ? (
              <div className="p-6 space-y-6">
                {/* 파일 정보 */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">파일 정보</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 text-lg">
                      📄
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{fileData.file.name}</div>
                      <div className="text-sm text-gray-500">{fileData.file.path}</div>
                      <div className="text-xs text-gray-400">{fileData.file.mimeType}</div>
                    </div>
                  </div>
                </div>

                {/* 요약 통계 */}
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="활성 공유" value={fileData.summary.activeShareCount} color="emerald" />
                  <StatCard label="대기 요청" value={fileData.summary.pendingRequestCount} color="amber" />
                  <StatCard label="총 조회수" value={fileData.summary.totalViewCount} color="blue" />
                  <StatCard label="총 다운로드" value={fileData.summary.totalDownloadCount} color="indigo" />
                </div>

                {/* 아이템 목록 */}
                <ShareItemTable
                  items={fileData.items}
                  page={subPage}
                  totalItems={fileData.totalItems}
                  totalPages={fileData.totalPages}
                  hasNext={fileData.hasNext}
                  hasPrev={fileData.hasPrev}
                  onPageChange={setSubPage}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <span className="text-5xl mb-3">📄</span>
                <p className="text-sm">파일 ID를 입력하고 조회 버튼을 클릭하세요.</p>
              </div>
            )}
          </div>
        )}

        {/* === 파일별 전체 목록 (Q-3) === */}
        {subTab === 'fileGroupList' && (
          <div className="flex-1 overflow-auto">
            {loading.sub ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
                <span className="ml-2 text-gray-500">파일별 목록 로딩 중...</span>
              </div>
            ) : fileGroupData && fileGroupData.items.length > 0 ? (
              <>
                <div className="divide-y divide-gray-200">
                  {fileGroupData.items.map((item) => {
                    const isExpanded = expandedFileIds.has(item.file.id);
                    return (
                      <FileGroupRow
                        key={item.file.id}
                        item={item}
                        isExpanded={isExpanded}
                        onToggle={() => {
                          setExpandedFileIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.file.id)) next.delete(item.file.id);
                            else next.add(item.file.id);
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between px-6 py-3 border-t bg-white sticky bottom-0">
                  <div className="text-sm text-gray-500">
                    총 {fileGroupData.totalItems.toLocaleString()}개 파일
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFileGroupPage((p) => Math.max(1, p - 1))}
                      disabled={!fileGroupData.hasPrev}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      이전
                    </button>
                    <span className="text-sm text-gray-700 px-2">
                      {fileGroupPage} / {fileGroupData.totalPages}
                    </span>
                    <button
                      onClick={() => setFileGroupPage((p) => p + 1)}
                      disabled={!fileGroupData.hasNext}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      다음
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <span className="text-5xl mb-3">📁</span>
                <p className="text-sm">파일별 공유 요청 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* === 대상자별 전체 목록 (Q-4) === */}
        {subTab === 'targetGroupList' && (
          <div className="flex-1 overflow-auto">
            {loading.sub ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
                <span className="ml-2 text-gray-500">대상자별 목록 로딩 중...</span>
              </div>
            ) : targetGroupData && targetGroupData.items.length > 0 ? (
              <>
                <div className="divide-y divide-gray-200">
                  {targetGroupData.items.map((item) => {
                    const targetId = item.target.userId;
                    const isExpanded = expandedTargetIds.has(targetId);
                    return (
                      <TargetGroupRow
                        key={targetId}
                        item={item}
                        isExpanded={isExpanded}
                        onToggle={() => {
                          setExpandedTargetIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(targetId)) next.delete(targetId);
                            else next.add(targetId);
                            return next;
                          });
                        }}
                      />
                    );
                  })}
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between px-6 py-3 border-t bg-white sticky bottom-0">
                  <div className="text-sm text-gray-500">
                    총 {targetGroupData.totalItems.toLocaleString()}명 대상자
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTargetGroupPage((p) => Math.max(1, p - 1))}
                      disabled={!targetGroupData.hasPrev}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      이전
                    </button>
                    <span className="text-sm text-gray-700 px-2">
                      {targetGroupPage} / {targetGroupData.totalPages}
                    </span>
                    <button
                      onClick={() => setTargetGroupPage((p) => p + 1)}
                      disabled={!targetGroupData.hasNext}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      다음
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <span className="text-5xl mb-3">👥</span>
                <p className="text-sm">대상자별 공유 요청 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </div>
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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'blue' | 'indigo';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

/** 상세 패널 (A-3) */
function DetailPanel({
  data,
  loading: isLoading,
  onClose,
}: {
  data: FileShareRequestDetail;
  loading: boolean;
  onClose: () => void;
}) {
  const st = STATUS_MAP[data.status];

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
        <h3 className="font-semibold text-gray-900">요청 상세</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* 상태 */}
        <Section label="상태">
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${st.bg} ${st.color}`}>
              {st.label}
            </span>
            {data.isAutoApproved && (
              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                자동 승인
              </span>
            )}
          </div>
        </Section>

        {/* 요청자 */}
        {data.requester && (
          <Section label="요청자">
            <UserCard user={data.requester} />
          </Section>
        )}

        {/* 지정 승인자 */}
        {data.designatedApproverDetail && (
          <Section label="지정 승인자">
            <UserCard user={data.designatedApproverDetail} />
          </Section>
        )}

        {/* 공유 대상 */}
        <Section label={`공유 대상 (${data.targets.length}명)`}>
          <div className="space-y-2">
            {data.targets.map((target, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      target.type === 'INTERNAL_USER'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {target.type === 'INTERNAL_USER' ? '내부' : '외부'}
                  </span>
                  {target.userDetail ? (
                    <span className="text-sm font-medium text-gray-900">
                      {target.userDetail.name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">{target.userId.slice(0, 8)}...</span>
                  )}
                </div>
                {target.userDetail && (
                  <div className="mt-1 text-xs text-gray-500">{target.userDetail.email}</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* 파일 */}
        <Section label={`파일 (${data.files?.length ?? data.fileIds.length}개)`}>
          <div className="space-y-1.5">
            {data.files && data.files.length > 0
              ? data.files.map((f) => (
                  <div key={f.id} className="p-2.5 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[240px]">
                        {f.name}
                      </div>
                      <div className="text-xs text-gray-400">{f.mimeType}</div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {formatBytes(f.sizeBytes)}
                    </span>
                  </div>
                ))
              : data.fileIds.map((fId) => (
                  <div key={fId} className="p-2 bg-gray-50 rounded text-sm text-gray-500 truncate">
                    {fId}
                  </div>
                ))}
          </div>
        </Section>

        {/* 권한 */}
        <Section label="권한">
          <span
            className={`inline-flex px-2.5 py-1 text-xs rounded ${
              data.permission.type === 'VIEW'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {data.permission.type === 'VIEW' ? '열람' : '다운로드'}
            {data.permission.maxDownloads ? ` (최대 ${data.permission.maxDownloads}회)` : ''}
          </span>
        </Section>

        {/* 공유 기간 */}
        <Section label="공유 기간">
          <div className="text-sm text-gray-700">
            {formatDateTime(data.startAt)} ~ {formatDateTime(data.endAt)}
          </div>
        </Section>

        {/* 요청 사유 */}
        <Section label="요청 사유">
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">{data.reason}</div>
        </Section>

        {/* 결정 정보 */}
        {data.decidedAt && (
          <Section label="결정 정보">
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
              {data.approver && (
                <div>
                  <span className="text-gray-500">결정자:</span>{' '}
                  <span className="font-medium">{data.approver.name}</span>
                  <span className="text-gray-400 ml-1">({data.approver.department})</span>
                </div>
              )}
              <div className="text-gray-500">결정일: {formatDateTime(data.decidedAt)}</div>
              {data.decisionComment && (
                <div className="mt-2 p-2.5 bg-white rounded border text-gray-700">
                  {data.decisionComment}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 요청일시 */}
        <Section label="요청일시">
          <div className="text-sm text-gray-700">{formatDateTime(data.requestedAt)}</div>
        </Section>

        {/* 수정일시 */}
        {data.updatedAt && (
          <Section label="수정일시">
            <div className="text-sm text-gray-700">{formatDateTime(data.updatedAt)}</div>
          </Section>
        )}

        {/* 공유 ID */}
        {data.publicShareIds.length > 0 && (
          <Section label="공유 ID">
            <div className="space-y-1">
              {data.publicShareIds.map((sid) => (
                <div key={sid} className="text-xs text-gray-500 font-mono bg-gray-50 p-1.5 rounded">
                  {sid}
                </div>
              ))}
            </div>
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

function UserCard({ user }: { user: { name: string; email: string; department: string; position?: string } }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="font-medium text-sm text-gray-900">{user.name}</div>
      <div className="text-xs text-gray-500">{user.email}</div>
      <div className="text-xs text-gray-500">
        {user.department}
        {user.position ? ` · ${user.position}` : ''}
      </div>
    </div>
  );
}

/** 그룹 요약 배지들 */
function GroupSummaryBadges({ summary }: { summary: GroupSummary }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {summary.pendingCount > 0 && (
        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
          대기 {summary.pendingCount}
        </span>
      )}
      {summary.approvedCount > 0 && (
        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">
          승인 {summary.approvedCount}
        </span>
      )}
      {summary.rejectedCount > 0 && (
        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">
          반려 {summary.rejectedCount}
        </span>
      )}
      {summary.canceledCount > 0 && (
        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
          취소 {summary.canceledCount}
        </span>
      )}
      {summary.activeShareCount > 0 && (
        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">
          활성 {summary.activeShareCount}
        </span>
      )}
    </div>
  );
}

/** 파일별 그룹 행 (Q-3) */
function FileGroupRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: FileGroupItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white">
      {/* 주 행 */}
      <div
        className="px-6 py-4 flex items-center gap-4 hover:bg-blue-50/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* 펼침 아이콘 */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* 파일 아이콘 + 정보 */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0">
            📄
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{item.file.name}</div>
            <div className="text-xs text-gray-400 truncate">{item.file.path} · {item.file.mimeType}</div>
          </div>
        </div>

        {/* 요약 배지 */}
        <div className="flex-shrink-0">
          <GroupSummaryBadges summary={item.summary} />
        </div>

        {/* 총 요청 수 */}
        <div className="text-right flex-shrink-0 w-20">
          <div className="text-sm font-semibold text-gray-900">{item.summary.totalRequestCount}건</div>
          <div className="text-xs text-gray-400">요청</div>
        </div>

        {/* 최근 요청일 */}
        <div className="text-right flex-shrink-0 w-28">
          <div className="text-xs text-gray-500">{formatDateTime(item.latestRequestedAt)}</div>
        </div>
      </div>

      {/* 펼침 영역: 요청 목록 */}
      {isExpanded && item.requests.length > 0 && (
        <div className="bg-gray-50 border-t">
          <table className="min-w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="px-6 py-2 text-left pl-16">상태</th>
                <th className="px-4 py-2 text-left">요청자</th>
                <th className="px-4 py-2 text-left">대상자</th>
                <th className="px-4 py-2 text-left">권한</th>
                <th className="px-4 py-2 text-left">기간</th>
                <th className="px-4 py-2 text-left">요청일</th>
                <th className="px-4 py-2 text-left">사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {item.requests.map((req) => (
                <RequestBriefRow key={req.id} req={req} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 대상자별 그룹 행 (Q-4) */
function TargetGroupRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: TargetGroupItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isExternal = item.target.type === 'EXTERNAL_USER';
  const company = isExternal ? (item.target as ExternalUserDetail).company : undefined;

  return (
    <div className="bg-white">
      {/* 주 행 */}
      <div
        className="px-6 py-4 flex items-center gap-4 hover:bg-blue-50/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* 펼침 아이콘 */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* 사용자 아바타 + 정보 */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            isExternal ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {item.target.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{item.target.name}</span>
              <span className={`px-1.5 py-0.5 text-xs rounded ${
                isExternal ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {isExternal ? '외부' : '내부'}
              </span>
            </div>
            <div className="text-xs text-gray-400 truncate">
              {item.target.email}
              {company ? ` · ${company}` : ''}
              {'department' in item.target && item.target.department ? ` · ${item.target.department}` : ''}
            </div>
          </div>
        </div>

        {/* 요약 배지 */}
        <div className="flex-shrink-0">
          <GroupSummaryBadges summary={item.summary} />
        </div>

        {/* 총 요청 수 */}
        <div className="text-right flex-shrink-0 w-20">
          <div className="text-sm font-semibold text-gray-900">{item.summary.totalRequestCount}건</div>
          <div className="text-xs text-gray-400">요청</div>
        </div>

        {/* 최근 요청일 */}
        <div className="text-right flex-shrink-0 w-28">
          <div className="text-xs text-gray-500">{formatDateTime(item.latestRequestedAt)}</div>
        </div>
      </div>

      {/* 펼침 영역: 요청 목록 */}
      {isExpanded && item.requests.length > 0 && (
        <div className="bg-gray-50 border-t">
          <table className="min-w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="px-6 py-2 text-left pl-16">상태</th>
                <th className="px-4 py-2 text-left">요청자</th>
                <th className="px-4 py-2 text-left">대상자</th>
                <th className="px-4 py-2 text-left">권한</th>
                <th className="px-4 py-2 text-left">기간</th>
                <th className="px-4 py-2 text-left">요청일</th>
                <th className="px-4 py-2 text-left">사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {item.requests.map((req) => (
                <RequestBriefRow key={req.id} req={req} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 요청 간략 행 (Q-3, Q-4 공통 펼침 영역) */
function RequestBriefRow({ req }: { req: ShareRequestBrief }) {
  const st = STATUS_MAP[req.status];
  return (
    <tr className="hover:bg-gray-100/50 text-sm">
      <td className="px-6 py-2.5 pl-16">
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${st.bg} ${st.color}`}>
          {st.label}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-gray-900">{req.requester.name}</div>
        <div className="text-xs text-gray-400">{req.requester.department}</div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {req.targets.slice(0, 2).map((t, i) => (
            <span
              key={i}
              className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${
                t.type === 'INTERNAL_USER' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
              }`}
            >
              {t.name}
            </span>
          ))}
          {req.targets.length > 2 && (
            <span className="text-xs text-gray-400">+{req.targets.length - 2}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className={`px-2 py-0.5 text-xs rounded ${
          req.permission === 'VIEW' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {req.permission === 'VIEW' ? '열람' : '다운로드'}
          {req.maxDownloads ? ` (${req.currentDownloadCount ?? 0}/${req.maxDownloads})` : ''}
        </span>
      </td>
      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
        {formatDate(req.startAt)} ~ {formatDate(req.endAt)}
      </td>
      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
        {formatDateTime(req.requestedAt)}
      </td>
      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate" title={req.reason}>
        {req.reason}
      </td>
    </tr>
  );
}

/** 공유 아이템 테이블 (Q-1, Q-2 공통) */
function ShareItemTable({
  items,
  page,
  totalItems,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
}: {
  items: ShareItemResult[];
  page: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (p: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
        조회 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청자</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">권한</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기간</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, idx) => {
            const isActive = item.source === 'ACTIVE_SHARE';
            return (
              <tr key={`${item.file.id}-${idx}`} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isActive ? '활성' : '대기'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900 truncate max-w-[200px]">
                    {item.file.name}
                  </div>
                  <div className="text-xs text-gray-400">{item.file.path}</div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900">{item.requester.name}</div>
                  <div className="text-xs text-gray-400">{item.requester.department}</div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        item.target.type === 'INTERNAL_USER'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-purple-50 text-purple-600'
                      }`}
                    >
                      {item.target.type === 'INTERNAL_USER' ? '내부' : '외부'}
                    </span>
                    <span className="text-gray-900">{item.target.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      item.permission === 'VIEW'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {item.permission === 'VIEW' ? '열람' : '다운로드'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {formatDate(item.startAt)} ~ {formatDate(item.endAt)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {isActive ? (
                    <div className="space-y-0.5">
                      <div className="text-xs text-gray-500">
                        조회 {item.currentViewCount ?? 0} / 다운 {item.currentDownloadCount ?? 0}
                      </div>
                      {item.isBlocked && (
                        <span className="inline-flex px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                          차단됨
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">
                      요청: {item.requestedAt ? formatDate(item.requestedAt) : '-'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
        <span className="text-sm text-gray-500">총 {totalItems.toLocaleString()}건</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={!hasPrev}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-white transition-colors"
          >
            이전
          </button>
          <span className="text-sm text-gray-700">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-white transition-colors"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
