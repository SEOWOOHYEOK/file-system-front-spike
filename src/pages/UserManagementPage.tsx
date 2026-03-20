/**
 * UserManagementPage - 사용자 관리 페이지
 * 조직도 사이드바 (부서 API 기반) + 사용자 목록 테이블 + DMS 역할 관리
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { adminUserApi } from '../api/adminUserApi';
import { roleApi } from '../api/roleApi';
import { departmentApi } from '../api/departmentApi';
import type { UserWithEmployee, Role, DepartmentPosition } from '../types/user.types';
import type { DepartmentHierarchyResponse, DepartmentType } from '../types/department.types';
import { DEPARTMENT_TYPE_LABELS } from '../types/department.types';

// ─── 아바타 색상 맵 ───

const AVATAR_COLORS = [
  'bg-red-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-teal-400',
  'bg-cyan-400',
  'bg-blue-400',
  'bg-indigo-400',
  'bg-violet-400',
  'bg-purple-400',
  'bg-pink-400',
  'bg-rose-400',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return name.charAt(0);
}

// ─── 부서 트리 헬퍼 ───

/** 부서 유형별 아이콘 색상 */
function getDeptIconColor(type: DepartmentType): string {
  switch (type) {
    case 'COMPANY':
      return 'text-gray-600';
    case 'DIVISION':
      return 'text-blue-500';
    case 'DEPARTMENT':
      return 'text-green-500';
    case 'TEAM':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

/** 특정 부서와 그 하위 부서의 모든 ID를 수집 */
function collectDepartmentIds(dept: DepartmentHierarchyResponse): string[] {
  const ids = [dept.id];
  for (const child of dept.children) {
    ids.push(...collectDepartmentIds(child));
  }
  return ids;
}

/** 부서 계층 트리에서 검색어로 필터링 */
function filterDepartmentTree(
  departments: DepartmentHierarchyResponse[],
  query: string,
): DepartmentHierarchyResponse[] {
  if (!query.trim()) return departments;
  const q = query.trim().toLowerCase();

  const filter = (dept: DepartmentHierarchyResponse): DepartmentHierarchyResponse | null => {
    const filteredChildren = dept.children
      .map(filter)
      .filter(Boolean) as DepartmentHierarchyResponse[];

    if (dept.departmentName.toLowerCase().includes(q) || filteredChildren.length > 0) {
      return { ...dept, children: filteredChildren };
    }
    return null;
  };

  return departments.map(filter).filter(Boolean) as DepartmentHierarchyResponse[];
}

// ─── 역할별 카운트 계산 ───

function getRoleCounts(
  users: UserWithEmployee[],
  roles: Role[]
): { name: string; count: number; color: string }[] {
  const counts = new Map<string, number>();
  for (const user of users) {
    const name = user.roleName || 'Guest';
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const colorMap: Record<string, string> = {
    Admin: 'bg-red-100 text-red-700',
    Manager: 'bg-blue-100 text-blue-700',
    User: 'bg-green-100 text-green-700',
    Guest: 'bg-gray-100 text-gray-500',
    Unknown: 'bg-yellow-100 text-yellow-700',
  };

  const order = ['Admin', 'Manager', 'User', 'Guest'];
  const result: { name: string; count: number; color: string }[] = [];

  for (const name of order) {
    if (counts.has(name)) {
      result.push({
        name,
        count: counts.get(name)!,
        color: colorMap[name] || 'bg-gray-100 text-gray-600',
      });
      counts.delete(name);
    }
  }

  // 나머지 역할
  for (const [name, count] of counts) {
    result.push({
      name,
      count,
      color: colorMap[name] || 'bg-gray-100 text-gray-600',
    });
  }

  return result;
}

// ─── 메인 컴포넌트 ───

export function UserManagementPage() {
  const { auth } = useInternalAuth();

  // ── 상태 ──
  const [users, setUsers] = useState<UserWithEmployee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 필터/검색
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // 부서 트리 (API 기반)
  const [departmentTree, setDepartmentTree] = useState<DepartmentHierarchyResponse[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentHierarchyResponse | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [deptSearchQuery, setDeptSearchQuery] = useState('');

  // 정렬
  const [sortField, setSortField] = useState<'name' | 'email'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // 역할 변경 로딩
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);

  // ── 데이터 로드 ──
  const fetchUsers = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    try {
      const data = await adminUserApi.getAll(auth.token);
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  const fetchRoles = useCallback(async () => {
    if (!auth.token) return;
    try {
      const data = await roleApi.getAll(auth.token);
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  }, [auth.token]);

  const fetchDepartments = useCallback(async () => {
    if (!auth.token) return;
    setDeptLoading(true);
    try {
      const data = await departmentApi.getHierarchy(auth.token);
      setDepartmentTree(data);
      // 최상위 부서들을 기본 확장
      const initialExpanded = new Set<string>();
      for (const dept of data) {
        initialExpanded.add(dept.id);
        // 하위 1레벨도 자동 확장
        for (const child of dept.children) {
          initialExpanded.add(child.id);
        }
      }
      setExpandedDepts(initialExpanded);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setDeptLoading(false);
    }
  }, [auth.token]);

  // 초기 로드
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchUsers();
      fetchRoles();
      fetchDepartments();
    }
  }, [auth.isAuthenticated, fetchUsers, fetchRoles, fetchDepartments]);

  // ── 역할 변경 ──
  const handleRoleChange = useCallback(
    async (userId: string, newRoleId: string) => {
      if (!auth.token) return;
      setChangingRoleFor(userId);
      try {
        if (newRoleId === '') {
          // 역할 제거
          await adminUserApi.removeRole(auth.token, userId);
        } else {
          // 역할 부여
          await adminUserApi.assignRole(auth.token, userId, { roleId: newRoleId });
        }
        // 사용자 목록 새로고침
        await fetchUsers();
      } catch (error) {
        console.error('Failed to change role:', error);
        alert('역할 변경에 실패했습니다.');
      } finally {
        setChangingRoleFor(null);
      }
    },
    [auth.token, fetchUsers]
  );

  // ── Employee 동기화 ──
  const handleSync = useCallback(async () => {
    if (!auth.token) return;
    setSyncing(true);
    try {
      const result = await adminUserApi.sync(auth.token);
      alert(
        `동기화 완료!\n생성: ${result.created} | 활성화: ${result.activated} | 비활성화: ${result.deactivated} | 건너뜀: ${result.skipped} | 변경없음: ${result.unchanged}\n처리시간: ${result.processingTimeMs}ms`
      );
      await fetchUsers();
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  }, [auth.token, fetchUsers]);

  // ── 트리 확장/축소 ──
  const toggleExpand = useCallback((deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  }, []);

  // ── 부서 선택 (선택된 부서 + 하위 부서 인원 모두 표시) ──
  const handleDeptSelect = useCallback((dept: DepartmentHierarchyResponse | null) => {
    setSelectedDepartment((prev) => (prev?.id === dept?.id ? null : dept));
  }, []);

  // ── 역할별 카운트 ──
  const roleCounts = useMemo(() => getRoleCounts(users, roles), [users, roles]);

  // ── 선택된 부서 및 하위 부서 ID 집합 ──
  const selectedDeptIds = useMemo(() => {
    if (!selectedDepartment) return null;
    return new Set(collectDepartmentIds(selectedDepartment));
  }, [selectedDepartment]);

  // ── 필터링된 사용자 목록 ──
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // 부서 필터 (선택된 부서 + 하위 부서 소속 인원)
    if (selectedDeptIds) {
      result = result.filter((user) =>
        user.employee?.departmentPositions.some(
          (dp) => selectedDeptIds.has(dp.departmentId)
        )
      );
    }

    // 역할 필터
    if (roleFilter !== 'all') {
      if (roleFilter === 'none') {
        result = result.filter((user) => !user.roleName);
      } else {
        result = result.filter((user) => user.roleId === roleFilter);
      }
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (user) =>
          user.employee?.name.toLowerCase().includes(q) ||
          user.employee?.email?.toLowerCase().includes(q)
      );
    }

    // 정렬
    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      if (sortField === 'name') {
        aVal = a.employee?.name || '';
        bVal = b.employee?.name || '';
      } else {
        aVal = a.employee?.email || '';
        bVal = b.employee?.email || '';
      }

      const cmp = aVal.localeCompare(bVal, 'ko');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, selectedDeptIds, roleFilter, searchQuery, sortField, sortDir]);

  // ── 정렬 토글 ──
  const handleSort = (field: 'name' | 'email') => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── 사용자의 첫 번째 부서/직책 가져오기 ──
  const getPrimaryDepartment = (
    dps?: DepartmentPosition[]
  ): { department: string; position: string } => {
    if (!dps || dps.length === 0) return { department: '-', position: '-' };
    // 선택된 부서가 있으면 해당 부서 소속 정보 우선
    if (selectedDeptIds) {
      const match = dps.find((dp) => selectedDeptIds.has(dp.departmentId));
      if (match) return { department: match.departmentName, position: match.positionTitle };
    }
    return { department: dps[0].departmentName, position: dps[0].positionTitle };
  };

  // ── 검색 필터링된 부서 트리 ──
  const filteredDeptTree = useMemo(
    () => filterDepartmentTree(departmentTree, deptSearchQuery),
    [departmentTree, deptSearchQuery],
  );

  // ── 인증 체크 ──
  if (!auth.isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
      </div>
    );
  }

  // ── 부서 트리 노드 렌더링 ──
  const renderDeptNode = (dept: DepartmentHierarchyResponse, depth: number = 0) => {
    const hasChildren = dept.children.length > 0;
    const isExpanded = expandedDepts.has(dept.id);
    const isSelected = selectedDepartment?.id === dept.id;
    const paddingLeft = depth * 16;

    return (
      <div key={dept.id}>
        <div
          className={`flex items-center py-1.5 px-2 cursor-pointer rounded-md text-sm transition-colors ${
            isSelected
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          style={{ paddingLeft: `${paddingLeft + 8}px` }}
          onClick={() => handleDeptSelect(dept)}
        >
          {/* 확장/축소 아이콘 */}
          {hasChildren ? (
            <span
              className="mr-1 text-gray-400 w-4 text-center flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(dept.id);
              }}
            >
              {isExpanded ? (
                <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          ) : (
            <span className="mr-1 w-4 flex-shrink-0" />
          )}

          {/* 부서 유형별 아이콘 */}
          {dept.type === 'COMPANY' ? (
            <svg className={`w-4 h-4 mr-1.5 flex-shrink-0 ${getDeptIconColor(dept.type)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : dept.type === 'DIVISION' ? (
            <svg className={`w-4 h-4 mr-1.5 flex-shrink-0 ${getDeptIconColor(dept.type)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 mr-1.5 flex-shrink-0 ${getDeptIconColor(dept.type)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}

          {/* 부서명 */}
          <span className="truncate flex-1">{dept.departmentName}</span>

          {/* 인원 수 */}
          {dept.memberCount > 0 && (
            <span className="text-xs text-gray-400 ml-1 flex-shrink-0">
              {dept.memberCount}
            </span>
          )}
        </div>

        {/* 자식 노드 */}
        {hasChildren && isExpanded && (
          <div>{dept.children.map((child) => renderDeptNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-130px)] bg-white rounded-lg shadow-sm overflow-hidden">
      {/* ─── 좌측: 조직 사이드바 ─── */}
      <aside className="w-72 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              조직
            </h3>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
              title="Employee 동기화"
            >
              {syncing ? '동기화...' : '동기화'}
            </button>
          </div>

          {/* 부서 검색 */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
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
            <input
              type="text"
              value={deptSearchQuery}
              onChange={(e) => setDeptSearchQuery(e.target.value)}
              placeholder="부서 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
            />
          </div>
        </div>

        {/* 역할별 카운트 배지 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {roleCounts.map((rc) => (
              <div
                key={rc.name}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rc.color}`}
              >
                <span className="mr-1">{rc.name}</span>
                <span className="font-bold">{rc.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 부서 계층 트리 */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {deptLoading || loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            </div>
          ) : filteredDeptTree.length > 0 ? (
            <>
              {filteredDeptTree.map((dept) => renderDeptNode(dept))}
              {/* 전체 보기 링크 */}
              {selectedDepartment && (
                <button
                  className="w-full mt-2 px-3 py-1.5 text-xs text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                  onClick={() => setSelectedDepartment(null)}
                >
                  전체 사용자 보기
                </button>
              )}
            </>
          ) : deptSearchQuery ? (
            <p className="text-xs text-gray-400 text-center py-4">
              "{deptSearchQuery}" 검색 결과가 없습니다
            </p>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
              부서 데이터를 불러오는 중...
            </p>
          )}
        </div>
      </aside>

      {/* ─── 우측: 사용자 목록 ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              사용자 목록
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({filteredUsers.length}명)
              </span>
              {selectedDepartment && (
                <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full inline-flex items-center">
                  {selectedDepartment.departmentName}
                  <span className="ml-1 text-blue-400">
                    ({DEPARTMENT_TYPE_LABELS[selectedDepartment.type]})
                  </span>
                </span>
              )}
            </h2>

            <div className="flex items-center gap-3">
              {/* 역할 필터 */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
              >
                <option value="all">전체 역할</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
                <option value="none">미할당</option>
              </select>

              {/* 검색 */}
              <div className="relative">
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
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름, 이메일로 검색..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-56 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <span className="ml-3 text-sm text-gray-500">사용자 목록을 불러오는 중...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-sm">
                {users.length === 0
                  ? '사용자 데이터가 없습니다'
                  : '검색 조건에 맞는 사용자가 없습니다'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th
                    className="px-6 py-3 cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      이름
                      {sortField === 'name' && (
                        <svg
                          className={`w-3 h-3 ml-1 transition-transform ${
                            sortDir === 'desc' ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3">이메일</th>
                  <th className="px-6 py-3">부서</th>
                  <th className="px-6 py-3">직책</th>
                  <th className="px-6 py-3">DMS 역할</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => {
                  const name = user.employee?.name || '-';
                  const email = user.employee?.email || '-';
                  const { department, position } = getPrimaryDepartment(
                    user.employee?.departmentPositions
                  );
                  const currentRoleName = user.roleName || 'Guest';

                  const isManagerRole = currentRoleName === 'Manager';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* 이름 + 아바타 */}
                      <td className="px-6 py-3">
                        <div className="flex items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3 flex-shrink-0 ${getAvatarColor(
                              name
                            )}`}
                          >
                            {getInitial(name)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {name}
                          </span>
                        </div>
                      </td>

                      {/* 이메일 */}
                      <td className="px-6 py-3 text-sm text-gray-500">{email}</td>

                      {/* 부서 */}
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {department}
                      </td>

                      {/* 직책 */}
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {position}
                      </td>

                      {/* DMS 역할 */}
                      <td className="px-6 py-3">
                        <select
                          value={user.roleId || ''}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={changingRoleFor === user.id || !user.isActive}
                          className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isManagerRole
                              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <option value="">Guest</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                        {changingRoleFor === user.id && (
                          <span className="ml-2 text-xs text-gray-400">변경 중...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
