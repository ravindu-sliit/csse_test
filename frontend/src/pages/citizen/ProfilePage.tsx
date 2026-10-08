import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-4">
      <div className="bg-white border rounded-xl p-6 text-center mb-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <User className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="font-bold text-lg">{user?.name}</h2>
        <p className="text-gray-500 text-sm">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">{user?.district} District</p>
      </div>

      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 font-medium py-3 rounded-xl hover:bg-red-50 transition-colors">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}