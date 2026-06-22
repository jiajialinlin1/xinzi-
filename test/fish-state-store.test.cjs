const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createFishStateStore } = require('../src/desktop/fish-state-store.cjs');

function createTestApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xinzi-fish-'));
  return {
    getPath() {
      return dir;
    }
  };
}

function clockState(status = 'working') {
  return {
    status,
    secondRateRmb: 0.02
  };
}

test('starts fishing only while working', () => {
  let now = new Date('2026-06-18T10:00:00+08:00');
  const store = createFishStateStore(createTestApp(), { now: () => now });

  assert.equal(store.start(clockState('off'), now).status, 'idle');
  assert.equal(store.start(clockState('working'), now).status, 'active');

  now = new Date('2026-06-18T10:03:00+08:00');
  const snapshot = store.getSnapshot(clockState('working'), now);
  assert.equal(snapshot.sessionSeconds, 180);
  assert.equal(Number(snapshot.sessionSalary.toFixed(2)), 3.6);
});

test('countdown enters active mode after three seconds', () => {
  let now = new Date('2026-06-18T10:00:00+08:00');
  const store = createFishStateStore(createTestApp(), { now: () => now });

  assert.equal(store.startCountdown(15, clockState('working'), now).status, 'countdown');

  now = new Date('2026-06-18T10:00:03+08:00');
  const snapshot = store.getSnapshot(clockState('working'), now);
  assert.equal(snapshot.status, 'active');
  assert.equal(snapshot.defaultMinutes, 15);
});

test('resume action continues fishing without stopping session', () => {
  let now = new Date('2026-06-18T10:00:00+08:00');
  const store = createFishStateStore(createTestApp(), { now: () => now });
  store.start(clockState('working'), now);

  now = new Date('2026-06-18T10:02:00+08:00');
  assert.equal(store.confirmStop(clockState('working'), now).status, 'confirmStop');

  now = new Date('2026-06-18T10:03:00+08:00');
  const snapshot = store.resume(clockState('working'), now);
  assert.equal(snapshot.status, 'active');
  assert.equal(snapshot.sessionSeconds, 180);
});

test('stop-and-save action returns to idle and saves current session', () => {
  let now = new Date('2026-06-18T10:00:00+08:00');
  const store = createFishStateStore(createTestApp(), { now: () => now });
  store.start(clockState('working'), now);

  now = new Date('2026-06-18T10:04:00+08:00');
  store.confirmStop(clockState('working'), now);

  now = new Date('2026-06-18T10:05:00+08:00');
  const snapshot = store.stopAndSave(clockState('working'), now);
  assert.equal(snapshot.status, 'idle');
  assert.equal(snapshot.accumulatedSecondsToday, 300);
  assert.equal(Number(snapshot.accumulatedSalaryToday.toFixed(2)), 6);
  assert.equal(snapshot.sessionSeconds, 0);
  assert.equal(snapshot.sessionsToday.length, 1);
  assert.equal(snapshot.sessionsToday[0].durationSeconds, 300);
});

test('auto-stops and saves when leaving working state', () => {
  let now = new Date('2026-06-18T10:00:00+08:00');
  const store = createFishStateStore(createTestApp(), { now: () => now });
  store.start(clockState('working'), now);

  now = new Date('2026-06-18T10:05:00+08:00');
  const snapshot = store.getSnapshot(clockState('lunch'), now);
  assert.equal(snapshot.status, 'idle');
  assert.equal(snapshot.accumulatedSecondsToday, 300);
  assert.equal(Number(snapshot.accumulatedSalaryToday.toFixed(2)), 6);
  assert.equal(snapshot.sessionsToday.length, 1);
});
