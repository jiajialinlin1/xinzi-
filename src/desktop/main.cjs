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

const WINDOW_WIDTH = 376;
const WINDOW_HEIGHT = 440;
const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAR0lEQVR4nGNgoCP4D8VUMYRiw6hiELohZBuGTRPJBuGynWRXUcUgfOFBUlhRxSBCMUR0DNLNIHQ1RBlEjDqiXUQIDyGDyAYAgcplmzSG3qgAAAAASUVORK5CYII=';

let tray;
let popover;

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

  createTray();
  createPopover();
  registerIpc();
  showPopover();
});

app.on('window-all-closed', () => {});

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
      { label: '显示', click: () => showPopover() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray.popUpContextMenu(menu);
  });
}

function createPopover() {
  popover = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  popover.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  popover.on('blur', () => {
    if (!popover.webContents.isDevToolsOpened()) {
      popover.hide();
    }
  });
}

function registerIpc() {
  ipcMain.handle('app:hide', () => {
    popover.hide();
  });
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
}

function positionPopover() {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  });
  const workArea = display.workArea;
  const x = Math.min(
    Math.max(Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2), workArea.x + 8),
    workArea.x + workArea.width - WINDOW_WIDTH - 8
  );
  const y = Math.round(trayBounds.y + trayBounds.height + 6);

  popover.setBounds({ x, y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
}
