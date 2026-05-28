export default function Loading() {
  return (
    <div className="mx-auto max-w-screen-xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-[88px] animate-pulse rounded-xl border border-white/10 bg-surface-card/70" />
      <div className="h-[72px] animate-pulse rounded-xl border border-white/10 bg-surface-card/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-white/10 bg-surface-card/70"
          />
        ))}
      </div>
    </div>
  );
}
