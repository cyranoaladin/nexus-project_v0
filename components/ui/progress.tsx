
export function Progress({ value = 0, className = '' }: { value?: number; className?: string; }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full h-2 bg-gray-200 rounded ${className}`}>
      <div
        className="h-2 bg-blue-600 rounded"
        style={{ width: `${pct}%`, transition: 'width 200ms ease' }}
      />
    </div>
  );
}

export default Progress;
