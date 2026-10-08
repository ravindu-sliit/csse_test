import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});
type FormData = z.infer<typeof schema>;

const ROLE_REDIRECT: Record<UserRole, string> = {
  CITIZEN: '/citizen/home',
  DMC_OFFICER: '/officer/dashboard',
  DMC_DUTY_OFFICER: '/officer/dashboard',
  DISTRICT_OFFICER: '/officer/dashboard',
  RESCUE_TEAM: '/officer/dashboard',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await login(data.email, data.password);
      const { useAuthStore } = await import('@/stores/authStore');
      const user = useAuthStore.getState().user;
      if (user) navigate(ROLE_REDIRECT[user.role], { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">DMC Sri Lanka</h1>
            <p className="text-gray-500 text-xs">Disaster Early-Warning System</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1">Sign in to your account</h2>
        <p className="text-gray-500 text-sm mb-6">Enter your credentials to continue</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-600 hover:underline font-medium">Register</Link>
        </p>

        {/* Quick login hints for dev */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg border">
          <p className="text-xs font-medium text-gray-600 mb-2">Test accounts:</p>
          <div className="space-y-1 text-xs text-gray-500">
            <p>DMC Officer: <span className="font-mono">national@dmc.lk</span></p>
            <p>Duty Officer: <span className="font-mono">officer@dmc.lk</span></p>
            <p>District Officer: <span className="font-mono">coord@dmc.lk</span></p>
            <p>Citizen: <span className="font-mono">citizen@test.lk</span></p>
            <p>Password: <span className="font-mono">Password123!</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}