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

const POPOVER_WIDTH = 376;
const POPOVER_HEIGHT = 420;
const MAIN_WIDTH = 920;
const MAIN_HEIGHT = 700;
const TICK_INTERVAL_MS = 1000;
const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAR0lEQVR4nGNgoCP4D8VUMYRiw6hiELohZBuGTRPJBuGynWRXUcUgfOFBUlhRxSBCMUR0DNLNIHQ1RBlEjDqiXUQIDyGDyAYAgcplmzSG3qgAAAAASUVORK5CYII=';

let tray;
let popover;
let mainWindow;
let store;
let settings;
let tickTimer;

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
  createTray();
  createPopover();
  registerIpc();
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
});

function createTray() {
  const icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_BASE64, 'base64'));
  icon.setTemplateImage(true);

  tray = new Tray(icon);
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
    minWidth: 820,
    minHeight: 620,
    show: false,
    title: '薪资计时器',
    backgroundColor: '#f5f7fb',
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
      state: getClockState()
    };
  });
  ipcMain.handle('clock:get-state', () => getClockState());
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
  updateTray(state);
  emitState(state);
}

function getClockState() {
  return computeClockState(settings, new Date());
}

function updateTray(state) {
  if (!tray) {
    return;
  }

  tray.setTitle(state.trayText);
  tray.setToolTip(`${state.statusText}\n今日已赚 ${formatRmb(state.earnedTodayRmb)}\n更新时间 ${formatTime(new Date(state.updatedAt))}`);
}

function emitState(state = getClockState()) {
  for (const window of [popover, mainWindow]) {
    if (window && !window.isDestroyed()) {
      window.webContents.send('clock:state', {
        settings,
        state
      });
    }
  }
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

function formatTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}
