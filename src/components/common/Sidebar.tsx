/**
 * Sidebar - 네비게이션 사이드바
 */
import { NavLink } from 'react-router-dom';

const navItems = [
  {
    title: '홈',
    path: '/',
    icon: '🏠',
  },
  {
    title: '내 파일',
    path: '/my-files',
    icon: '📁',
  },
  // {
  //   title: '공유 요청 관리(807)',
  //   path: '/admin/share-requests',
  //   icon: '📨',
  // },
 
  {
    title: '동기화 대시보드(802)',
    path: '/admin/sync-dashboard',
    icon: '🔄',
  },
  {
    title: 'NAS 관리(803)',
    path: '/admin/observability',
    icon: '📊',
  },

  {
    title: '파일 작업(이동, 삭제)요청 관리(850,860)',
    path: '/admin/file-action-requests',
    icon: '📋',
  },
  {
    title: '파일 결제 관리(모니터링 807)',
    path: '/admin/file-share-monitor',
    icon: '📊',
  },
  {
    title: '사용자관리(810)',
    path: '/admin/user-management',
    icon: '👤',
  },
  {
    title: '역할별 권한 관리(809)',
    path: '/admin/role-permissions',
    icon: '🛡️',
  },
  {
    title: '파일 공유 관리(전체805)',
    path: '/admin/share-management',
    icon: '🔗',
  },
  {
    title: '감사 로그',
    path: '/admin/audit-logs',
    icon: '📋',
  },
  {
    title: '받은 공유 요청(702)',
    path: '/my-received-requests',
    icon: '📬',
  },
  {
    title: '나에게 공유된 파일(710)',
    path: '/external-file-access',
    icon: '📥',
  },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">DMS API Tester</h1>
        <p className="text-xs text-gray-400">Admin & External Share</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-white border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <span className="mr-3">{item.icon}</span>
                {item.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        v1.0.0
      </div>
    </aside>
  );
}
