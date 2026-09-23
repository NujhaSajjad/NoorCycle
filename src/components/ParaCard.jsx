import { QUARTER_LABELS } from '../data/paraNames'
import CountdownTimer from './CountdownTimer'

export default function ParaCard({
  paraGroup,
  userId,
  onClaim,
  onComplete,
  claimLoading,
  completeLoading,
  staggerIndex
}) {
  const { para, slots } = paraGroup
  // Calculate completed quarters
  const doneCount = slots.filter(s => s.status === 'completed').length
  const isMine = slots.some(s => s.status === 'pending' && s.claimed_by === userId)
  
  // Radial ring calculation
  const r = 17
  const ringC = 2 * Math.PI * r
  const offset = ringC - (doneCount / 4) * ringC

  return (
    <div
      className={`para-card animate-fade-in-up stagger-${staggerIndex} ${isMine ? 'mine' : ''}`}
      id={`para-${para.number}`}
    >
      <div className="pc-head">
        <div className="pc-ring">
          <svg viewBox="0 0 40 40">
            <circle className="pc-ring-track" cx="20" cy="20" r="17" />
            <circle
              className="pc-ring-fill"
              cx="20"
              cy="20"
              r="17"
              strokeDasharray={ringC}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="pc-ring-num">{doneCount}/4</div>
        </div>
        <div className="pc-title">
          <span className="name">Para {para.number} — {para.english}</span>
          <span className="frac">
            {doneCount === 4 ? 'Completed' : `${doneCount} of 4 quarters read`}
          </span>
        </div>
      </div>

      <div className="pc-quarters">
        {slots.map(slot => {
          const qInfo = QUARTER_LABELS.find(q => q.quarter === slot.quarter)
          const qName = qInfo?.english ?? `Quarter ${slot.quarter}`
          
          const expired = slot.status === 'pending' && slot.expires_at && new Date(slot.expires_at) < new Date()
          const status = (slot.status === 'pending' && expired) ? 'available' : slot.status
          
          const pendingMe = status === 'pending' && slot.claimed_by === userId

          let cls = ''
          let valTxt = ''
          let onClick = undefined

          if (status === 'available') {
            cls = 'available'
            valTxt = claimLoading ? '...' : 'Contribute'
            onClick = () => onClaim(slot.para_number, slot.quarter)
          } else if (status === 'pending') {
            if (pendingMe) {
              cls = 'reading'
              valTxt = completeLoading ? '...' : 'Mark as read'
              onClick = () => onComplete(slot.para_number, slot.quarter)
            } else {
              cls = 'other'
              valTxt = 'Being read'
            }
          } else if (status === 'completed') {
            cls = 'done'
            valTxt = '✓ Done'
          }

          return (
            <button
              key={`${slot.para_number}-${slot.quarter}`}
              className={`pc-q ${cls}`}
              onClick={onClick}
              disabled={(cls === 'available' && claimLoading) || (cls === 'reading' && completeLoading)}
            >
              <span className="lbl">{qName}</span>
              {pendingMe && slot.expires_at ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span className="val">{valTxt}</span>
                  <CountdownTimer expiresAt={slot.expires_at} />
                </div>
              ) : (
                <span className="val">{valTxt}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}