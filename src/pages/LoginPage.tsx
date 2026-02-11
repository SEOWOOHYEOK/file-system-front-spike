/**
 * LoginPage - SSO 로그인 페이지
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import type { AuthErrorResponse } from '../types/auth.types';
import axios from 'axios';

export function LoginPage() {
  const { auth, login, isLoading } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 이미 인증된 경우 원래 페이지로 리다이렉트
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  if (auth.isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as AuthErrorResponse | undefined;
        setError(data?.message || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
      } else {
        setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">DMS</h1>
          <p className="text-gray-400 mt-1">Document Management System</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                  focus:border-transparent transition-all"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                  focus:border-transparent transition-all"
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium
                rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </form>
        </div>

        {/* 하단 정보 */}
        <p className="text-center text-gray-500 text-xs mt-6">
          SSO 인증 기반 로그인 &middot; 내부/외부 사용자 지원
        </p>
      </div>
    </div>
  );
}
