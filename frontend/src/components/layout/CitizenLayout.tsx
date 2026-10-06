import { NavLink, Outlet } from 'react-router-dom';
import { Home, Bell, Plus, Map, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CitizenLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">DMC</span>
          </div>
          <span className="font-semibold text-sm">DMC Sri Lanka</span>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100" aria-label="Notifications">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Nav — fixed, safe area aware */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around">
          {[
            { to: '/citizen/home', icon: Home, label: 'Home' },
            { to: '/citizen/alerts', icon: Bell, label: 'Alerts' },
            { to: '/citizen/report', icon: Plus, label: 'Report', isCta: true },
            { to: '/citizen/map', icon: Map, label: 'Map' },
            { to: '/citizen/profile', icon: User, label: 'Profile' },
          ].map(({ to, icon: Icon, label, isCta }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 transition-colors',
                  isActive ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
                )
              }
              aria-label={label}
            >
              {isCta ? (
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center -mt-3 shadow-lg">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              ) : (
                <Icon className="w-6 h-6" />
              )}
              <span className="text-xs">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}