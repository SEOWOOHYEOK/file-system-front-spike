/**
 * ProtectedRoute - 인증 필요 라우트 가드
 *
 * 인증되지 않은 사용자를 로그인 페이지로 리다이렉트합니다.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { auth } = useAuthContext();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    // 현재 경로를 state로 전달하여 로그인 후 원래 경로로 돌아갈 수 있게 함
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
