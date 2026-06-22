const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeSettings } = require('../src/desktop/settings-store.cjs');

test('normalizes custom fish review rules', () => {
  const settings = normalizeSettings({
    hireDate: '2026-06-18',
    salaryHistory: [{ effectiveFrom: '2026-06-18', monthlySalaryRmb: 10000 }],
    fishReviewRules: [
      { minMinutes: 0, maxMinutes: 3, comment: '刚起步。' },
      { minMinutes: 4, maxMinutes: '', comment: '够可以。' },
      { minMinutes: 8, maxMinutes: 2, comment: '非法。' }
    ]
  });

  assert.deepEqual(settings.fishReviewRules, [
    { minMinutes: 0, maxMinutes: 3, comment: '刚起步。' },
    { minMinutes: 4, maxMinutes: null, comment: '够可以。' }
  ]);
});
