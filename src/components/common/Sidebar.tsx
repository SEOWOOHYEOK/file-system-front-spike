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
    title: '500.관리자',
    path: '/admin',
    icon: '⚙️',
  },
  {
    title: '510.관리자-공유',
    path: '/admin/shares',
    icon: '📋',
  },
  {
    title: '520.외부사용자',
    path: '/admin/external-users',
    icon: '👥',
  },
  {
    title: '600.외부공유',
    path: '/shares',
    icon: '🔗',
  },
  {
    title: '700/710.외부접근',
    path: '/external',
    icon: '🌐',
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
