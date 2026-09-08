/**
 * Animated progress bar showing the daily Quran completion progress.
 */
export default function ProgressBar({ completed, total }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-charcoal">
          {completed} / {total} paras completed
        </span>
        <span className="text-sm font-medium text-charcoal-light">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full h-3 bg-cream-dark rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            background:
              percentage === 100
                ? 'linear-gradient(90deg, #A8DADC, #7BBFC2)'
                : 'linear-gradient(90deg, #C4B088, #A8DADC)',
          }}
        />
      </div>
    </div>
  )
}
