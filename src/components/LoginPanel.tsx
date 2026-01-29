/**
 * LoginPanel Component
 * 외부 사용자 로그인/로그아웃 UI
 */
import { useState } from 'react';
import type { AuthState } from '../hooks/useAuth';

interface LoginPanelProps {
  auth: AuthState;
  onLogin: (username: string, password: string) => Promise<unknown>;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export function LoginPanel({
  auth,
  onLogin,
  onLogout,
  onRefresh,
  disabled = false,
}: LoginPanelProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      await onLogin(username, password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await onLogout();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 토큰 만료 시간 포맷
  const formatExpiry = () => {
    if (!auth.expiresAt) return '-';
    const remaining = Math.max(0, Math.floor((auth.expiresAt.getTime() - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${auth.isAuthenticated ? 'bg-green-500' : 'bg-gray-300'}`}></span>
        인증 상태
      </h2>

      {auth.isAuthenticated ? (
        <div className="space-y-3">
          <div className="text-sm">
            <div className="text-gray-600">사용자</div>
            <div className="font-medium">{auth.user?.name} ({auth.user?.username})</div>
          </div>
          
          <div className="text-sm">
            <div className="text-gray-600">회사</div>
            <div className="font-medium">{auth.user?.company || '-'}</div>
          </div>
          
          <div className="text-sm">
            <div className="text-gray-600">토큰 만료</div>
            <div className="font-mono text-orange-600">{formatExpiry()}</div>
          </div>
          
          <div className="text-sm">
            <div className="text-gray-600">Access Token</div>
            <div className="font-mono text-xs bg-gray-100 p-2 rounded truncate">
              {auth.accessToken?.substring(0, 50)}...
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading || disabled}
              className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
            >
              토큰 갱신
            </button>
            <button
              onClick={handleLogout}
              disabled={loading || disabled}
              className="flex-1 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
            >
              로그아웃
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || disabled}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="external_user_001"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || disabled}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || disabled || !username || !password}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      )}
    </div>
  );
}
