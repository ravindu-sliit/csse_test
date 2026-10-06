import { cn } from '@/lib/utils';

export function SkeletonRow({ cols = 4, className }: { cols?: number; className?: string }) {
  return (
    <tr className={className}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (i * 15) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white border rounded-xl p-4 animate-pulse', className)}>
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-full mb-1" />
      <div className="h-3 bg-gray-200 rounded w-4/5" />
    </div>
  );
}