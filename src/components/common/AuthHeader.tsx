/**
 * AuthHeader - 인증 상태 표시 헤더
 */
import { useAuthContext } from '../../contexts/AuthContext';

export function AuthHeader() {
  const { auth, logout, isLoading } = useAuthContext();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">내부 SSO 인증</span>
          {auth.userType && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {auth.userType === 'internal' ? '내부 사용자' : '외부 사용자'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {auth.isAuthenticated && auth.user ? (
            <>
              <div className="text-sm">
                <span className="text-gray-500">로그인:</span>{' '}
                <span className="font-medium text-gray-900">{auth.user.name}</span>
                {auth.user.email && (
                  <span className="text-gray-400 ml-1">({auth.user.email})</span>
                )}
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors disabled:opacity-50"
              >
                로그아웃
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-400">로그인되지 않음</span>
          )}
        </div>
      </div>
    </header>
  );
}
