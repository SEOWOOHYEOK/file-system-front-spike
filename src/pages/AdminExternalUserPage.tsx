/**
 * AdminExternalUserPage - 520.관리자-외부사용자 관리
 */
import { useState, useEffect, useCallback } from 'react';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { adminExternalUserApi, setAdminLogCallback } from '../api/adminApi';
import { ResultLog } from '../components/ResultLog';
import type {
  ExternalUser,
  CreateExternalUserDto,
  UpdateExternalUserDto,
  AdminApiLogEntry,
} from '../types/admin.types';
import type { ApiLogEntry } from '../types/api.types';

export function AdminExternalUserPage() {
  const { auth } = useInternalAuth();
  
  // 사용자 목록/상세
  const [users, setUsers] = useState<ExternalUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  
  // 폼 상태
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formData, setFormData] = useState<CreateExternalUserDto>({
    username: '',
    password: '',
    name: '',
    email: '',
    company: '',
    phone: '',
  });
  
  // 로딩 상태
  const [loading, setLoading] = useState({
    list: false,
    detail: false,
    action: false,
  });

  // 임시 비밀번호 표시
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // API 로그
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  // 로그 콜백 설정
  useEffect(() => {
    setAdminLogCallback((log: AdminApiLogEntry) => {
      const convertedLog: ApiLogEntry = {
        id: log.id,
        timestamp: log.timestamp,
        method: log.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: log.url,
        status: log.status,
        duration: log.duration,
        request: log.request,
        response: log.response,
        error: log.error,
      };
      setLogs((prev) => [convertedLog, ...prev].slice(0, 100));
    });
    return () => setAdminLogCallback(null);
  }, []);

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, list: true }));
    try {
      const response = await adminExternalUserApi.getList(auth.token);
      setUsers(response.items);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading((prev) => ({ ...prev, list: false }));
    }
  }, [auth.token]);

  // 사용자 상세 조회
  const fetchUserDetail = useCallback(async (user: ExternalUser) => {
    if (!auth.token) return;
    setSelectedUser(user);
    setLoading((prev) => ({ ...prev, detail: true }));
    try {
      const response = await adminExternalUserApi.getDetail(auth.token, user.id);
      setSelectedUser(response);
    } catch (error) {
      console.error('Failed to fetch user detail:', error);
    } finally {
      setLoading((prev) => ({ ...prev, detail: false }));
    }
  }, [auth.token]);

  // 사용자 생성
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.token) return;
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminExternalUserApi.create(auth.token, formData);
      setShowCreateForm(false);
      setFormData({ username: '', password: '', name: '', email: '', company: '', phone: '' });
      fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 사용자 수정
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.token || !selectedUser) return;
    
    const updateData: UpdateExternalUserDto = {
      name: formData.name || undefined,
      email: formData.email || undefined,
      company: formData.company || undefined,
      phone: formData.phone || undefined,
    };
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminExternalUserApi.update(auth.token, selectedUser.id, updateData);
      setShowEditForm(false);
      fetchUsers();
      fetchUserDetail(selectedUser);
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 계정 활성화
  const handleActivate = async (userId: string) => {
    if (!auth.token) return;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminExternalUserApi.activate(auth.token, userId);
      fetchUsers();
      if (selectedUser?.id === userId) {
        fetchUserDetail(selectedUser);
      }
    } catch (error) {
      console.error('Failed to activate user:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 계정 비활성화
  const handleDeactivate = async (userId: string) => {
    if (!auth.token) return;
    if (!confirm('이 사용자를 비활성화하시겠습니까?')) return;
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await adminExternalUserApi.deactivate(auth.token, userId);
      fetchUsers();
      if (selectedUser?.id === userId) {
        fetchUserDetail(selectedUser);
      }
    } catch (error) {
      console.error('Failed to deactivate user:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 비밀번호 초기화
  const handleResetPassword = async (userId: string) => {
    if (!auth.token) return;
    if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
    
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      const response = await adminExternalUserApi.resetPassword(auth.token, userId);
      setTempPassword(response.temporaryPassword);
    } catch (error) {
      console.error('Failed to reset password:', error);
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  };

  // 수정 폼 열기
  const openEditForm = () => {
    if (!selectedUser) return;
    setFormData({
      username: selectedUser.username,
      password: '',
      name: selectedUser.name,
      email: selectedUser.email,
      company: selectedUser.company || '',
      phone: selectedUser.phone || '',
    });
    setShowEditForm(true);
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">520.관리자-외부사용자</h2>
          <p className="text-sm text-gray-500">외부 사용자 계정 관리</p>
        </div>
        <button
          onClick={() => { setShowCreateForm(true); setFormData({ username: '', password: '', name: '', email: '', company: '', phone: '' }); }}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          + 사용자 생성
        </button>
      </div>

      {/* 임시 비밀번호 알림 */}
      {tempPassword && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-green-800">비밀번호가 초기화되었습니다</p>
            <p className="text-sm text-green-700">임시 비밀번호: <code className="bg-green-100 px-2 py-0.5 rounded">{tempPassword}</code></p>
          </div>
          <button onClick={() => setTempPassword(null)} className="text-green-600 hover:text-green-700">닫기</button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: User List */}
        <div className="col-span-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">외부 사용자 목록</h3>
              <button
                onClick={fetchUsers}
                disabled={loading.list}
                className="text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                {loading.list ? '조회 중...' : '새로고침'}
              </button>
            </div>
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2">
              {users.length > 0 ? users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => fetchUserDetail(user)}
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    selectedUser?.id === user.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{user.name}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${
                      user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    @{user.username} | {user.email}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  {loading.list ? '로딩 중...' : '새로고침을 클릭하세요'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Detail or Form */}
        <div className="col-span-4">
          {showCreateForm || showEditForm ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-3">
                {showCreateForm ? '새 사용자 생성' : '사용자 정보 수정'}
              </h3>
              <form onSubmit={showCreateForm ? handleCreate : handleUpdate} className="space-y-3">
                {showCreateForm && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">사용자명 *</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">비밀번호 *</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">이메일 *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">회사</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading.action}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    {loading.action ? '처리 중...' : showCreateForm ? '생성' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setShowEditForm(false); }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          ) : selectedUser ? (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-3">사용자 상세</h3>
              {loading.detail ? (
                <p className="text-sm text-gray-400">로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">사용자명</label>
                    <p className="text-sm font-medium">@{selectedUser.username}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">이름</label>
                    <p className="text-sm">{selectedUser.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">이메일</label>
                    <p className="text-sm">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">회사</label>
                    <p className="text-sm">{selectedUser.company || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">전화번호</label>
                    <p className="text-sm">{selectedUser.phone || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">상태</label>
                    <p className="text-sm">
                      {selectedUser.isActive ? (
                        <span className="text-green-600">활성</span>
                      ) : (
                        <span className="text-gray-500">비활성</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">초기 비밀번호</label>
                    <p className="text-sm">{selectedUser.isInitialPassword ? '예' : '아니오'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">마지막 로그인</label>
                    <p className="text-sm">{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">생성일</label>
                    <p className="text-sm">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={openEditForm}
                        disabled={loading.action}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleResetPassword(selectedUser.id)}
                        disabled={loading.action}
                        className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded disabled:opacity-50"
                      >
                        비밀번호 초기화
                      </button>
                      {selectedUser.isActive ? (
                        <button
                          onClick={() => handleDeactivate(selectedUser.id)}
                          disabled={loading.action}
                          className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-50"
                        >
                          비활성화
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(selectedUser.id)}
                          disabled={loading.action}
                          className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50"
                        >
                          활성화
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-400 text-center">사용자를 선택하세요</p>
            </div>
          )}
        </div>

        {/* Right: API Log */}
        <div className="col-span-4">
          <div className="h-[calc(100vh-280px)]">
            <ResultLog logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>
      </div>
    </div>
  );
}
