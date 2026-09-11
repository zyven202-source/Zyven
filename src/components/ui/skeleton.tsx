import { cn } from '@/lib/utils';

/**
 * Skeleton loading primitives.
 * A soft shimmer block that mirrors the shape of real content so pages
 * feel instant and stable instead of jumping when data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

/** Skeleton row shaped like a list item (product, transaction, customer). */
export function SkeletonList({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-surface border border-border-subtle"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16 flex-shrink-0" />
          </div>
          <div className="flex gap-5 mt-3 pt-3 border-t border-border-subtle">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a stats/summary card. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface border border-border-subtle rounded-xl p-4', className)}>
      <Skeleton className="h-4 w-4 mb-2" />
      <Skeleton className="h-3 w-3/4 mb-1.5" />
      <Skeleton className="h-6 w-1/2" />
    </div>
  );
}

/** Full dashboard loading layout. */
export function SkeletonDashboard() {
  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-6 pb-24 lg:pb-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="bg-surface border border-border-subtle rounded-2xl p-5 space-y-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}

/** Full inventory loading layout. */
export function SkeletonInventory() {
  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <SkeletonStat /><SkeletonStat /><SkeletonStat />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <SkeletonList rows={7} />
    </div>
  );
}

/** Simple centered page loading with shimmer. */
export function SkeletonPage({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" role="status">
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <span className="text-primary font-bold text-base">Z</span>
      </div>
      <p className="text-text-muted text-sm">{label}</p>
    </div>
  );
}

/** Narrow skeleton for reading-detail screens with a long left column. */
export function SkeletonDetail() {
  return (
    <div className="px-4 lg:px-8 py-5 max-w-4xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          ['Buying Price'], ['Selling Price'], ['Profit / Unit'], ['Margin'],
        ].map((cols, i) => (
          <div key={i} className="bg-surface border border-border-subtle rounded-xl p-4">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border-subtle rounded-xl p-4 space-y-2">
        {[
          ['Current Stock'], ['Minimum Stock'], ['Stock Value (cost]'], ['Potential Revenue'], ['Potential Profit'],
        ].map((cols, i) => (
          <div key={i} className="flex justify-between text-sm">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[['7-Day Sales'], ['30-Day Sales'], ['Velocity /day']].map((cols, i) => (
          <div key={i} className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
            <Skeleton className="h-3 w-20 mx-auto mb-1" />
            <Skeleton className="h-7 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
