const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createUiStateStore } = require('../src/desktop/ui-state-store.cjs');

function createTestApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xinzi-ui-'));
  return {
    getPath() {
      return dir;
    }
  };
}

test('toggles and persists hidden metric state', () => {
  const app = createTestApp();
  const store = createUiStateStore(app);

  assert.equal(store.getState().hiddenMetrics.totalEarned, false);
  assert.equal(store.toggleHiddenMetric('totalEarned').hiddenMetrics.totalEarned, true);

  const reloadedStore = createUiStateStore(app);
  assert.equal(reloadedStore.getState().hiddenMetrics.totalEarned, true);
});

test('ignores unknown hidden metric keys', () => {
  const store = createUiStateStore(createTestApp());

  assert.deepEqual(store.toggleHiddenMetric('unknown'), store.getState());
});
