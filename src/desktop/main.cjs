const path = require('node:path');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  screen
} = require('electron');
const { computeClockState } = require('./salary-clock.cjs');
const { createSettingsStore } = require('./settings-store.cjs');
const { createCalendarService } = require('./calendar-service.cjs');
const { createFishStateStore } = require('./fish-state-store.cjs');
const { createUiStateStore } = require('./ui-state-store.cjs');

const POPOVER_WIDTH = 376;
const POPOVER_HEIGHT = 420;
const MAIN_WIDTH = 1120;
const MAIN_HEIGHT = 820;
const TICK_INTERVAL_MS = 1000;
const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAR0lEQVR4nGNgoCP4D8VUMYRiw6hiELohZBuGTRPJBuGynWRXUcUgfOFBUlhRxSBCMUR0DNLNIHQ1RBlEjDqiXUQIDyGDyAYAgcplmzSG3qgAAAAASUVORK5CYII=';

let tray;
let popover;
let mainWindow;
let store;
let settings;
let tickTimer;
let calendarService;
let fishStore;
let uiStore;
let trayIconImage;
let trayTextRenderer;
let trayTextRendererReady;
let activeTrayTextKey = '';
let pendingTrayTextKey = '';
let renderedTrayTextKey = '';
let latestTrayTextImage = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showPopover();
  });
}

app.whenReady().then(() => {
  if (app.dock) {
    app.dock.hide();
  }

  store = createSettingsStore(app);
  settings = store.load();
  calendarService = createCalendarService(app);
  fishStore = createFishStateStore(app);
  uiStore = createUiStateStore(app);
  createTray();
  createPopover();
  registerIpc();
  calendarService.refresh().then(() => tick()).catch(() => tick());
  startClock();
  if (process.argv.includes('--open-main')) {
    openMainWindow();
  } else {
    showPopover();
  }
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (tickTimer) {
    clearInterval(tickTimer);
  }
  if (trayTextRenderer && !trayTextRenderer.isDestroyed()) {
    trayTextRenderer.destroy();
  }
});

function createTray() {
  trayIconImage = createTrayIconImage();

  tray = new Tray(trayIconImage);
  tray.setToolTip('');
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('mouse-enter', () => showPopover());
  tray.on('click', () => togglePopover());
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: '打开桌面界面', click: () => openMainWindow() },
      { label: '显示状态', click: () => showPopover() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray.popUpContextMenu(menu);
  });
}

function createPopover() {
  popover = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: false,
    webPreferences: sharedWebPreferences()
  });

  popover.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: { view: 'popover' }
  });
  popover.on('blur', () => {
    if (!popover.webContents.isDevToolsOpened()) {
      popover.hide();
    }
  });
}

function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    emitState();
    return;
  }

  mainWindow = new BrowserWindow({
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    minWidth: 980,
    minHeight: 720,
    show: false,
    title: '薪资计时器',
    backgroundColor: '#fffaf0',
    webPreferences: sharedWebPreferences()
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: { view: 'main' }
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    emitState();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sharedWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false
  };
}

function registerIpc() {
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:save', (_event, nextSettings) => {
    settings = store.save(nextSettings);
    tick();
    return {
      settings,
      state: getClockState(),
      calendar: getCalendarStatus(),
      fish: getFishState(),
      ui: getUiState()
    };
  });
  ipcMain.handle('clock:get-state', () => getClockState());
  ipcMain.handle('ui:get-state', () => getUiState());
  ipcMain.handle('ui:toggle-hidden-metric', (_event, key) => {
    const ui = uiStore.toggleHiddenMetric(key);
    emitState(getClockState(), undefined, ui);
    return ui;
  });
  ipcMain.handle('fish:get-state', () => getFishState());
  ipcMain.handle('fish:start', () => {
    const state = getClockState();
    const fish = fishStore.start(state);
    emitState(state, fish);
    return fish;
  });
  ipcMain.handle('fish:start-countdown', (_event, minutes) => {
    const state = getClockState();
    const fish = fishStore.startCountdown(minutes, state);
    emitState(state, fish);
    return fish;
  });
  ipcMain.handle('fish:confirm-stop', () => {
    const state = getClockState();
    const fish = fishStore.confirmStop(state);
    emitState(state, fish);
    return fish;
  });
  ipcMain.handle('fish:resume', () => {
    const state = getClockState();
    const fish = fishStore.resume(state);
    emitState(state, fish);
    return fish;
  });
  ipcMain.handle('fish:stop-and-save', () => {
    const state = getClockState();
    const fish = fishStore.stopAndSave(state);
    emitState(state, fish);
    return fish;
  });
  ipcMain.handle('fish:update-default-minutes', (_event, minutes) => {
    const state = getClockState();
    const fish = fishStore.updateDefaultMinutes(minutes, state);
    emitState(state, fish);
    return fish;
  });
  ipcMain.handle('calendar:get-status', () => getCalendarStatus());
  ipcMain.handle('calendar:request-access', async () => {
    await calendarService.requestAccess();
    tick();
    return getCalendarStatus();
  });
  ipcMain.handle('calendar:get-day-overrides', () => getCalendarOverrides());
  ipcMain.handle('window:open-main', () => {
    openMainWindow();
  });
  ipcMain.handle('window:show-popover', () => {
    showPopover();
  });
  ipcMain.handle('app:hide-popover', () => {
    popover.hide();
  });
}

function startClock() {
  tick();
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
}

function tick() {
  const state = getClockState();
  const fish = getFishState(state);
  updateTray(state, fish);
  emitState(state, fish);
}

function getClockState() {
  return computeClockState(settings, new Date(), getCalendarOverrides());
}

function updateTray(state, fish) {
  if (!tray) {
    return;
  }

  if (isFishingTrayState(fish)) {
    const fishMinutes = formatFishMinutes(fish.sessionSeconds);
    const fishSalary = formatRmb(fish.sessionSalary);
    const line1 = `摸鱼${fishMinutes}分`;
    const line2 = `怒赚${fishSalary}`;
    const trayTextKey = `${line1}\n${line2}`;

    activeTrayTextKey = trayTextKey;
    renderTrayTextImageLater(trayTextKey, line1, line2);
    if (latestTrayTextImage) {
      tray.setImage(latestTrayTextImage);
      tray.setTitle('');
    } else {
      tray.setImage(trayIconImage);
      tray.setTitle(`${line1} ${line2}`);
    }
    tray.setToolTip('');
    return;
  }

  activeTrayTextKey = '';
  tray.setImage(trayIconImage);
  tray.setTitle(state.trayText);
  tray.setToolTip('');
}

function emitState(state = getClockState(), fish = getFishState(state), ui = getUiState()) {
  for (const window of [popover, mainWindow]) {
    if (window && !window.isDestroyed()) {
      window.webContents.send('clock:state', {
        settings,
        state,
        calendar: getCalendarStatus(),
        fish,
        ui
      });
    }
  }
}

function getFishState(state = getClockState()) {
  return fishStore ? fishStore.getSnapshot(state) : null;
}

function getUiState() {
  return uiStore ? uiStore.getState() : null;
}

function getCalendarStatus() {
  return calendarService ? calendarService.getStatus() : null;
}

function getCalendarOverrides() {
  const status = getCalendarStatus();
  if (!status || status.permissionStatus !== 'granted' || !status.available) {
    return {
      holidayDates: [],
      workdayDates: []
    };
  }

  return {
    holidayDates: status.holidayDates,
    workdayDates: status.workdayDates
  };
}

function togglePopover() {
  if (popover.isVisible()) {
    popover.hide();
  } else {
    showPopover();
  }
}

function showPopover() {
  if (!tray || !popover) {
    return;
  }

  positionPopover();
  popover.show();
  popover.focus();
  emitState();
}

function positionPopover() {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  });
  const workArea = display.workArea;
  const x = Math.min(
    Math.max(Math.round(trayBounds.x + trayBounds.width / 2 - POPOVER_WIDTH / 2), workArea.x + 8),
    workArea.x + workArea.width - POPOVER_WIDTH - 8
  );
  const y = Math.round(trayBounds.y + trayBounds.height + 6);

  popover.setBounds({ x, y, width: POPOVER_WIDTH, height: POPOVER_HEIGHT });
}

function formatRmb(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function createTrayIconImage() {
  const icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_BASE64, 'base64'));
  icon.setTemplateImage(true);
  return icon;
}

function renderTrayTextImageLater(key, line1, line2) {
  if (renderedTrayTextKey === key || pendingTrayTextKey === key) {
    return;
  }

  pendingTrayTextKey = key;
  createTrayTextImage(line1, line2)
    .then((image) => {
      if (pendingTrayTextKey === key) {
        pendingTrayTextKey = '';
      }
      if (!tray || activeTrayTextKey !== key || image.isEmpty()) {
        return;
      }

      latestTrayTextImage = image;
      renderedTrayTextKey = key;
      tray.setImage(image);
      tray.setTitle('');
      tray.setToolTip('');
    })
    .catch(() => {
      if (pendingTrayTextKey === key) {
        pendingTrayTextKey = '';
      }
    });
}

async function createTrayTextImage(line1, line2) {
  await ensureTrayTextRenderer();
  const width = Math.min(138, Math.max(72, Math.ceil(Math.max(measureTrayText(line1), measureTrayText(line2)) + 8)));
  const height = 22;
  const dataUrl = await trayTextRenderer.webContents.executeJavaScript(`
    (() => {
      const width = ${width};
      const height = ${height};
      const scale = 2;
      let canvas = document.getElementById('tray-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'tray-canvas';
        document.body.appendChild(canvas);
      }
      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000';
      ctx.font = '800 10.4px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(${JSON.stringify(line1)}, 4, 9);
      ctx.fillText(${JSON.stringify(line2)}, 4, 20);
      return canvas.toDataURL('image/png');
    })()
  `);
  const image = nativeImage.createFromDataURL(dataUrl).resize({ width, height, quality: 'best' });
  image.setTemplateImage(true);
  return image;
}

function ensureTrayTextRenderer() {
  if (trayTextRenderer && !trayTextRenderer.isDestroyed()) {
    return trayTextRendererReady;
  }

  trayTextRenderer = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true
    }
  });
  trayTextRendererReady = trayTextRenderer.loadURL('data:text/html;charset=utf-8,<html><body style="margin:0;background:transparent"></body></html>');
  return trayTextRendererReady;
}

function measureTrayText(text) {
  return Array.from(String(text || '')).reduce((width, character) => {
    if (/[\u4e00-\u9fff]/.test(character)) {
      return width + 11;
    }
    if (/[0-9]/.test(character)) {
      return width + 6;
    }
    if (/[A-Z]/i.test(character)) {
      return width + 6.5;
    }
    return width + 5.5;
  }, 0);
}

function formatFishMinutes(seconds) {
  return Math.floor(Math.max(0, Number(seconds) || 0) / 60);
}

function isFishingTrayState(fish) {
  return fish && (fish.status === 'active' || fish.status === 'confirmStop');
}

function formatTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}
