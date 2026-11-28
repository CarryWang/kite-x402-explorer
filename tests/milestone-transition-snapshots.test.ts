import test from 'node:test';
import assert from 'node:assert/strict';
const A = '0x1111111111111111111111111111111111111111' as const;
const B = '0x2222222222222222222222222222222222222222' as const;
const C = '0x3333333333333333333333333333333333333333' as const;
import { createMilestoneTask, releaseMilestonePayout } from '../src/lib/task-milestone-escrow.js';

function vault() { return createMilestoneTask('local', A, B, 100n, [
  { milestoneId: 'first', title: 'First', percentageBps: 5000 },
  { milestoneId: 'second', title: 'Second', percentageBps: 5000 },
]); }

test('an older vault cannot rewrite a pending payout in its successor snapshot', () => {
  const initial = vault();
  const next = releaseMilestonePayout(initial, 'first').vault;
  initial.milestones[1].payoutWei = 999n;
  initial.milestones[1].isCompleted = true;
  assert.equal(next.milestones[1].payoutWei, 50n);
  assert.equal(next.milestones[1].isCompleted, false);
  const finished = releaseMilestonePayout(next, 'second').vault;
  assert.equal(finished.releasedWei, 100n);
  assert.equal(finished.remainingWei, 0n);
});

test('all successor milestone records are independent while completed state is preserved', () => {
  const initial = vault();
  const next = releaseMilestonePayout(initial, 'first').vault;
  next.milestones[1].title = 'Changed successor';
  assert.equal(initial.milestones[1].title, 'Second');
  assert.equal(initial.milestones[0].isCompleted, false);
  assert.equal(next.milestones[0].isCompleted, true);
});
