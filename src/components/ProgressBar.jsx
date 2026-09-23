export default function ProgressBar({ completed, total }) {
  const pct = total > 0 ? (completed / total) * 100 : 0
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-text">
          {completed} / {total} paras completed
        </span>
        <span className="text-xs font-semibold text-rose-dark">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="w-full h-2 bg-rose-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-rose), var(--color-rose-dark))',
          }}
        />
      </div>
    </div>
  )
}