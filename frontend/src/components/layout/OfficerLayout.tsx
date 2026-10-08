import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Bell, FileText, Users, Home, BarChart2, Settings, LogOut, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfficerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/officer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/officer/warnings', icon: Bell, label: 'Warnings' },
    { to: '/officer/reports', icon: FileText, label: 'Reports', roles: ['DMC_OFFICER', 'DMC_DUTY_OFFICER'] },
    { to: '/officer/my-missions', icon: Users, label: 'My Missions', roles: ['RESCUE_TEAM'] },
    { to: '/officer/coordination', icon: Users, label: 'Coordinate Response', roles: ['DISTRICT_OFFICER'] },
    { to: '/officer/shelters', icon: Home, label: 'Shelters' },
    { to: '/officer/analytics', icon: BarChart2, label: 'Analytics', roles: ['DMC_OFFICER', 'DMC_DUTY_OFFICER'] },
    { to: '/officer/settings', icon: Settings, label: 'Settings' },
  ];

  const visibleItems = navItems.filter(item => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1a1f2e] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">DMC Sri Lanka</p>
            <p className="text-gray-400 text-xs">Officer Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-white/10 text-white border-l-2 border-amber-500'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-white/10">
          <p className="text-white text-sm font-medium truncate">{user?.name}</p>
          <p className="text-gray-400 text-xs mb-3">{user?.role?.replace(/_/g, ' ')}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}