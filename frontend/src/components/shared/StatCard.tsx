import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  dot?: 'red' | 'orange' | 'green' | 'blue' | 'purple';
  subtext?: string;
  className?: string;
}

const DOT_COLOURS = {
  red: 'bg-red-500',
  orange: 'bg-orange-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

export function StatCard({ label, value, dot, subtext, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border p-5', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm">{label}</span>
        {dot && <span className={cn('w-2 h-2 rounded-full', DOT_COLOURS[dot])} />}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}