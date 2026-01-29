/**
 * AuthHeader - 인증 상태 표시 헤더
 */
import { useState } from 'react';
import { useInternalAuth } from '../../hooks/useInternalAuth';

export function AuthHeader() {
  const { auth, login, logout, isLoading } = useInternalAuth();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await login(email, password);
      setShowLoginForm(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">내부 SSO 인증 (500~600 API용)</span>
        </div>

        <div className="flex items-center space-x-4">
          {auth.isAuthenticated ? (
            <>
              <div className="text-sm">
                <span className="text-gray-500">로그인:</span>{' '}
                <span className="font-medium text-gray-900">{auth.user?.name}</span>
                <span className="text-gray-400 ml-1">({auth.user?.email})</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              {showLoginForm ? (
                <form onSubmit={handleLogin} className="flex items-center space-x-2">
                  <input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? '...' : '로그인'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLoginForm(false)}
                    className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                  >
                    취소
                  </button>
                  {error && <span className="text-sm text-red-500">{error}</span>}
                </form>
              ) : (
                <>
                  <span className="text-sm text-gray-400">로그인되지 않음</span>
                  <button
                    onClick={() => setShowLoginForm(true)}
                    className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  >
                    로그인
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
