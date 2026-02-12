/**
 * RolePermissionPage - 역할별 권한 매핑 관리 페이지
 * 809.관리자 - 역할별 권한 매트릭스 조회 / 권한 추가·제거
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { rolePermissionApi, setRolePermissionLogCallback } from '../api/rolePermissionApi';
import type {
  RolePermissionResponse,
  PermissionCategory,
  RolePermissionApiLogEntry,
} from '../types/role-permission.types';

// ── 카테고리 한글 라벨 매핑 ──
const CATEGORY_LABELS: Record<string, string> = {
  'User Management': '사용자 관리',
  'Role Management': '역할 관리',
  'Audit & Monitoring': '감사 & 모니터링',
  'File Management': '파일 관리',
  'File Request/Approval': '파일 요청/승인',
  'Trash & Recovery': '휴지통 & 복구',
  'Share Management': '공유 관리',
  'External Share Access': '외부 공유 접근',
  'Folder Management': '폴더 관리',
};

// ── 카테고리 아이콘 ──
const CATEGORY_ICONS: Record<string, string> = {
  'User Management': '👤',
  'Role Management': '🔑',
  'Audit & Monitoring': '📊',
  'File Management': '📁',
  'File Request/Approval': '📋',
  'Trash & Recovery': '🗑️',
  'Share Management': '🔗',
  'External Share Access': '🌐',
  'Folder Management': '📂',
};

// ── 역할별 색상 ──
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  ADMIN: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
  MANAGER: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  USER: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
  GUEST: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-800' },
};

function getRoleColor(roleName: string) {
  return ROLE_COLORS[roleName] || ROLE_COLORS.GUEST;
}

// ── 역할 한글 라벨 ──
const ROLE_LABELS: Record<string, string> = {
  ADMIN: '관리자',
  MANAGER: '매니저',
  USER: '사용자',
  GUEST: '게스트',
};

export function RolePermissionPage() {
  const { auth } = useInternalAuth();

  // ── 상태 ──
  const [rolePermissions, setRolePermissions] = useState<RolePermissionResponse[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiLogs, setApiLogs] = useState<RolePermissionApiLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // "roleId-permCode"
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'matrix' | 'role'>('matrix');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // ── 토스트 ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── API 로그 콜백 ──
  useEffect(() => {
    setRolePermissionLogCallback((log) => {
      setApiLogs((prev) => [log, ...prev].slice(0, 50));
    });
    return () => setRolePermissionLogCallback(null);
  }, []);

  // ── 데이터 로드 ──
  const loadData = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    setError(null);
    try {
      const [matrixData, permData] = await Promise.all([
        rolePermissionApi.getAll(auth.token),
        rolePermissionApi.getAllPermissions(auth.token),
      ]);
      setRolePermissions(matrixData);
      setAllPermissions(permData);
    } catch (err) {
      const message = err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── 권한 추가 ──
  const handleAddPermission = useCallback(
    async (roleId: string, permissionCode: string) => {
      if (!auth.token) return;
      const key = `${roleId}-${permissionCode}`;
      setActionLoading(key);
      try {
        const updated = await rolePermissionApi.addPermission(auth.token, roleId, permissionCode);
        setRolePermissions((prev) =>
          prev.map((rp) => (rp.roleId === roleId ? updated : rp)),
        );
        showToast(`권한 '${permissionCode}' 추가 완료`, 'success');
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { data?: { errorCode?: number; message?: string } } };
          const errData = axiosErr.response?.data;
          if (errData?.errorCode === 7004) {
            showToast('이미 해당 역할에 부여된 권한입니다.', 'error');
          } else if (errData?.errorCode === 7003) {
            showToast('유효하지 않은 권한 코드입니다.', 'error');
          } else if (errData?.errorCode === 7002) {
            showToast('역할을 찾을 수 없습니다.', 'error');
          } else {
            showToast(errData?.message || '권한 추가 실패', 'error');
          }
        } else {
          showToast('권한 추가 중 오류가 발생했습니다.', 'error');
        }
      } finally {
        setActionLoading(null);
      }
    },
    [auth.token, showToast],
  );

  // ── 권한 제거 ──
  const handleRemovePermission = useCallback(
    async (roleId: string, permissionCode: string) => {
      if (!auth.token) return;
      const key = `${roleId}-${permissionCode}`;
      setActionLoading(key);
      try {
        const updated = await rolePermissionApi.removePermission(auth.token, roleId, permissionCode);
        setRolePermissions((prev) =>
          prev.map((rp) => (rp.roleId === roleId ? updated : rp)),
        );
        showToast(`권한 '${permissionCode}' 제거 완료`, 'success');
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { data?: { errorCode?: number; message?: string } } };
          const errData = axiosErr.response?.data;
          if (errData?.errorCode === 7005) {
            showToast('해당 역할에 부여되지 않은 권한입니다.', 'error');
          } else if (errData?.errorCode === 7002) {
            showToast('역할을 찾을 수 없습니다.', 'error');
          } else {
            showToast(errData?.message || '권한 제거 실패', 'error');
          }
        } else {
          showToast('권한 제거 중 오류가 발생했습니다.', 'error');
        }
      } finally {
        setActionLoading(null);
      }
    },
    [auth.token, showToast],
  );

  // ── 권한 토글 ──
  const handleToggle = useCallback(
    (roleId: string, permissionCode: string, hasPermission: boolean) => {
      if (hasPermission) {
        handleRemovePermission(roleId, permissionCode);
      } else {
        handleAddPermission(roleId, permissionCode);
      }
    },
    [handleAddPermission, handleRemovePermission],
  );

  // ── 권한 맵 생성 (roleId -> Set<permissionCode>) ──
  const permissionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const rp of rolePermissions) {
      map.set(rp.roleId, new Set(rp.permissions.map((p) => p.code)));
    }
    return map;
  }, [rolePermissions]);

  // ── 필터링 ──
  const filteredCategories = useMemo(() => {
    let categories = allPermissions;

    if (selectedCategory !== 'all') {
      categories = categories.filter((c) => c.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      categories = categories
        .map((cat) => ({
          ...cat,
          permissions: cat.permissions.filter(
            (p) =>
              p.code.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q),
          ),
        }))
        .filter((cat) => cat.permissions.length > 0);
    }

    return categories;
  }, [allPermissions, selectedCategory, searchQuery]);

  // ── 총 권한 수 계산 ──
  const totalPermissions = useMemo(
    () => allPermissions.reduce((sum, cat) => sum + cat.permissions.length, 0),
    [allPermissions],
  );

  // ── 인증 체크 ──
  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-medium">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">역할별 권한 매핑 관리</h1>
            <p className="text-sm text-gray-500 mt-1">
              809.관리자 - 역할별 권한 매트릭스 조회 및 관리
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'matrix'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                매트릭스
              </button>
              <button
                onClick={() => setViewMode('role')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'role'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                역할별
              </button>
            </div>

            {/* 로그 토글 */}
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showLogs
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              API 로그 {apiLogs.length > 0 && `(${apiLogs.length})`}
            </button>

            {/* 새로고침 */}
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading ? '로딩...' : '새로고침'}
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
            <span className="text-indigo-600 font-semibold text-sm">{rolePermissions.length}</span>
            <span className="text-indigo-600 text-xs">역할</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
            <span className="text-emerald-600 font-semibold text-sm">{totalPermissions}</span>
            <span className="text-emerald-600 text-xs">전체 권한</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
            <span className="text-amber-600 font-semibold text-sm">{allPermissions.length}</span>
            <span className="text-amber-600 text-xs">카테고리</span>
          </div>
          {rolePermissions.map((rp) => {
            const color = getRoleColor(rp.roleName);
            return (
              <div key={rp.roleId} className={`flex items-center gap-2 px-3 py-2 ${color.bg} rounded-lg`}>
                <span className={`font-semibold text-sm ${color.text}`}>
                  {rp.permissions.length}
                </span>
                <span className={`text-xs ${color.text}`}>
                  {ROLE_LABELS[rp.roleName] || rp.roleName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        {/* 검색 */}
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="권한 코드 또는 설명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* 카테고리 필터 */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">전체 카테고리</option>
          {allPermissions.map((cat) => (
            <option key={cat.category} value={cat.category}>
              {CATEGORY_LABELS[cat.category] || cat.category} ({cat.permissions.length})
            </option>
          ))}
        </select>

        {/* 역할 필터 (역할별 뷰) */}
        {viewMode === 'role' && (
          <select
            value={selectedRole || ''}
            onChange={(e) => setSelectedRole(e.target.value || null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">모든 역할</option>
            {rolePermissions.map((rp) => (
              <option key={rp.roleId} value={rp.roleId}>
                {ROLE_LABELS[rp.roleName] || rp.roleName} ({rp.permissions.length} 권한)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-xs text-red-600 underline hover:text-red-800"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm mt-3">데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : viewMode === 'matrix' ? (
          /* ── 매트릭스 뷰 ── */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[260px]">
                      권한
                    </th>
                    {rolePermissions.map((rp) => {
                      const color = getRoleColor(rp.roleName);
                      return (
                        <th
                          key={rp.roleId}
                          className="text-center px-4 py-3 min-w-[120px]"
                        >
                          <span
                            className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${color.badge}`}
                          >
                            {ROLE_LABELS[rp.roleName] || rp.roleName}
                          </span>
                          <div className="text-[10px] text-gray-400 mt-1">
                            {rp.permissions.length}개 권한
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <CategoryBlock
                      key={category.category}
                      category={category}
                      rolePermissions={rolePermissions}
                      permissionMap={permissionMap}
                      actionLoading={actionLoading}
                      onToggle={handleToggle}
                    />
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td
                        colSpan={rolePermissions.length + 1}
                        className="text-center py-12 text-gray-400 text-sm"
                      >
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── 역할별 뷰 ── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {rolePermissions
              .filter((rp) => !selectedRole || rp.roleId === selectedRole)
              .map((rp) => (
                <RoleCard
                  key={rp.roleId}
                  role={rp}
                  allPermissions={filteredCategories}
                  permissionSet={permissionMap.get(rp.roleId) || new Set()}
                  actionLoading={actionLoading}
                  onToggle={handleToggle}
                />
              ))}
          </div>
        )}
      </div>

      {/* API 로그 패널 */}
      {showLogs && (
        <div className="border-t border-gray-200 bg-white max-h-64 overflow-auto">
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between sticky top-0">
            <span className="text-xs font-semibold text-gray-600">
              API 로그 ({apiLogs.length})
            </span>
            <button
              onClick={() => setApiLogs([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              초기화
            </button>
          </div>
          {apiLogs.length === 0 ? (
            <div className="px-6 py-4 text-xs text-gray-400 text-center">
              아직 API 호출 기록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {apiLogs.map((log) => (
                <ApiLogItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 하위 컴포넌트
// ═══════════════════════════════════════════════

/** 매트릭스 카테고리 블록 */
function CategoryBlock({
  category,
  rolePermissions,
  permissionMap,
  actionLoading,
  onToggle,
}: {
  category: PermissionCategory;
  rolePermissions: RolePermissionResponse[];
  permissionMap: Map<string, Set<string>>;
  actionLoading: string | null;
  onToggle: (roleId: string, permissionCode: string, has: boolean) => void;
}) {
  return (
    <>
      {/* 카테고리 헤더 */}
      <tr className="bg-gray-50/60">
        <td
          colSpan={rolePermissions.length + 1}
          className="px-4 py-2 sticky left-0"
        >
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <span>{CATEGORY_ICONS[category.category] || '📌'}</span>
            {CATEGORY_LABELS[category.category] || category.category}
            <span className="text-gray-400 font-normal ml-1">
              ({category.permissions.length})
            </span>
          </span>
        </td>
      </tr>
      {/* 권한 행 */}
      {category.permissions.map((perm) => (
        <tr
          key={perm.code}
          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
        >
          <td className="px-4 py-2.5 sticky left-0 bg-white z-10">
            <div className="flex flex-col">
              <code className="text-xs font-mono text-indigo-600 font-medium">{perm.code}</code>
              <span className="text-[11px] text-gray-400 mt-0.5">{perm.description}</span>
            </div>
          </td>
          {rolePermissions.map((rp) => {
            const has = permissionMap.get(rp.roleId)?.has(perm.code) ?? false;
            const key = `${rp.roleId}-${perm.code}`;
            const isLoading = actionLoading === key;

            return (
              <td key={rp.roleId} className="text-center px-4 py-2.5">
                <button
                  onClick={() => onToggle(rp.roleId, perm.code, has)}
                  disabled={isLoading}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                    isLoading
                      ? 'opacity-50 cursor-wait'
                      : has
                        ? 'bg-emerald-100 text-emerald-600 hover:bg-red-100 hover:text-red-500'
                        : 'bg-gray-100 text-gray-300 hover:bg-emerald-100 hover:text-emerald-500'
                  }`}
                  title={has ? `${perm.code} 권한 제거` : `${perm.code} 권한 추가`}
                >
                  {isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : has ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/** 역할별 카드 뷰 */
function RoleCard({
  role,
  allPermissions,
  permissionSet,
  actionLoading,
  onToggle,
}: {
  role: RolePermissionResponse;
  allPermissions: PermissionCategory[];
  permissionSet: Set<string>;
  actionLoading: string | null;
  onToggle: (roleId: string, permissionCode: string, has: boolean) => void;
}) {
  const color = getRoleColor(role.roleName);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const totalPerms = allPermissions.reduce((s, c) => s + c.permissions.length, 0);

  return (
    <div className={`bg-white rounded-xl border ${color.border} shadow-sm overflow-hidden`}>
      {/* 카드 헤더 */}
      <div className={`${color.bg} px-5 py-4 border-b ${color.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full ${color.badge}`}>
              {role.roleName}
            </span>
            <h3 className={`text-lg font-semibold ${color.text} mt-1`}>
              {role.roleDescription || ROLE_LABELS[role.roleName] || role.roleName}
            </h3>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${color.text}`}>{role.permissions.length}</div>
            <div className="text-xs text-gray-400">/ {totalPerms} 권한</div>
          </div>
        </div>
        {/* 프로그레스 바 */}
        <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              color.text.includes('red')
                ? 'bg-red-400'
                : color.text.includes('blue')
                  ? 'bg-blue-400'
                  : color.text.includes('green')
                    ? 'bg-green-400'
                    : 'bg-gray-400'
            }`}
            style={{ width: `${totalPerms > 0 ? (role.permissions.length / totalPerms) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 카테고리 아코디언 */}
      <div className="divide-y divide-gray-100 max-h-96 overflow-auto">
        {allPermissions.map((cat) => {
          const assignedInCat = cat.permissions.filter((p) => permissionSet.has(p.code)).length;
          const isExpanded = expandedCategories.has(cat.category);

          return (
            <div key={cat.category}>
              <button
                onClick={() => toggleCategory(cat.category)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="text-xs">{CATEGORY_ICONS[cat.category] || '📌'}</span>
                  {CATEGORY_LABELS[cat.category] || cat.category}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${assignedInCat > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {assignedInCat}/{cat.permissions.length}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {isExpanded && (
                <div className="px-5 pb-3 space-y-1">
                  {cat.permissions.map((perm) => {
                    const has = permissionSet.has(perm.code);
                    const key = `${role.roleId}-${perm.code}`;
                    const isLoading = actionLoading === key;

                    return (
                      <div
                        key={perm.code}
                        className="flex items-center justify-between py-1.5 pl-6"
                      >
                        <div className="flex-1 min-w-0">
                          <code className="text-xs font-mono text-indigo-600">{perm.code}</code>
                          <span className="text-[11px] text-gray-400 ml-2">{perm.description}</span>
                        </div>
                        <button
                          onClick={() => onToggle(role.roleId, perm.code, has)}
                          disabled={isLoading}
                          className={`ml-2 flex-shrink-0 w-8 h-5 rounded-full relative transition-colors ${
                            isLoading
                              ? 'opacity-50 cursor-wait bg-gray-200'
                              : has
                                ? 'bg-emerald-400'
                                : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              has ? 'left-3.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** API 로그 아이템 */
function ApiLogItem({ log }: { log: RolePermissionApiLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    log.status >= 200 && log.status < 300
      ? 'text-green-600 bg-green-50'
      : log.status >= 400
        ? 'text-red-600 bg-red-50'
        : 'text-gray-600 bg-gray-50';

  const methodColor: Record<string, string> = {
    GET: 'text-blue-600',
    POST: 'text-green-600',
    DELETE: 'text-red-600',
    PUT: 'text-amber-600',
    PATCH: 'text-purple-600',
  };

  return (
    <div className="px-6 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-3 text-xs">
        <span className={`font-mono font-semibold ${methodColor[log.method] || 'text-gray-600'}`}>
          {log.method}
        </span>
        <span className="text-gray-600 font-mono flex-1 truncate">{log.url}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor}`}>
          {log.status}
        </span>
        <span className="text-gray-400">{log.duration}ms</span>
        <span className="text-gray-300">{log.timestamp.toLocaleTimeString()}</span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          {log.request != null && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 mb-1">Request:</div>
              <pre className="text-[10px] bg-gray-900 text-green-400 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(log.request, null, 2)}
              </pre>
            </div>
          )}
          {log.response != null && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 mb-1">Response:</div>
              <pre className="text-[10px] bg-gray-900 text-green-400 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(log.response, null, 2)}
              </pre>
            </div>
          )}
          {log.error && (
            <div>
              <div className="text-[10px] font-semibold text-red-500 mb-1">Error:</div>
              <pre className="text-[10px] bg-red-50 text-red-600 p-2 rounded">{log.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
