// Node script that mirrors the SQL get_assignment formula from 004/005.
// Tests:
//   1. Part formula exact: Part = ((p - 1 + day - 1) % 120) + 1
//   2. Every participant gets every part exactly once across 120 days.
//   3. para_number / quarter conversion.
//   4. Missing a day does not shift a future day's assignment.

function partToParaQuarter(part) {
  return {
    part_number: part,
    para_number: Math.ceil(part / 4),
    quarter: ((part - 1) % 4) + 1,
  }
}

function computeAssignment(participantNumber, programDay) {
  const part = ((participantNumber - 1 + programDay - 1) % 120) + 1
  return partToParaQuarter(part)
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exitCode = 1
    throw new Error(msg)
  }
}

// 1. Exact formula
for (let p = 1; p <= 120; p++) {
  for (let day = 1; day <= 5; day++) {
    const expected = ((p - 1 + day - 1) % 120) + 1
    assert(computeAssignment(p, day).part_number === expected, `formula mismatch p=${p} day=${day}`)
  }
}

// 2. All 120 rotations -> each participant sees every part exactly once
for (let p = 1; p <= 120; p++) {
  const seen = new Set()
  for (let day = 1; day <= 120; day++) {
    seen.add(computeAssignment(p, day).part_number)
  }
  assert(seen.size === 120, `participant ${p} did not see all 120 parts (saw ${seen.size})`)
}

// 3. para/quarter boundaries
assert(computeAssignment(1, 1).part_number === 1)
assert(computeAssignment(1, 1).para_number === 1)
assert(computeAssignment(1, 1).quarter === 1)
assert(computeAssignment(4, 1).part_number === 4)
assert(computeAssignment(4, 1).para_number === 1)
assert(computeAssignment(4, 1).quarter === 4)
assert(computeAssignment(5, 1).part_number === 5)
assert(computeAssignment(5, 1).para_number === 2)
assert(computeAssignment(5, 1).quarter === 1)
assert(computeAssignment(120, 1).part_number === 120)
assert(computeAssignment(120, 1).para_number === 30)
assert(computeAssignment(120, 1).quarter === 4)

// 4. Missing a day does not shift sequence (date based)
const a = computeAssignment(7, 10)
const b = computeAssignment(7, 12)
// Day 11 skipped, but day 12 formula unchanged:
assert(b.part_number === ((7 - 1 + 12 - 1) % 120) + 1)
// And day 10 result still formula-based:
assert(a.part_number === ((7 - 1 + 10 - 1) % 120) + 1)

// 5. Wrap-around boundary
assert(computeAssignment(120, 2).part_number === 1) // 120+2? (119+1)%120=0+1=1
assert(computeAssignment(1, 120).part_number === 120) // (0+119)%120=119+1=120

console.log('All assignment tests passed (120 participants x 120 days).')
