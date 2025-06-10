/* eslint-disable no-console */
import { app, BrowserWindow, globalShortcut } from 'electron';
import fs from 'fs-extra';
import Screenshots, { LongCapture } from '.';

app.whenReady().then(() => {
  const screenshots = new Screenshots({
    lang: {
      operation_rectangle_title: '矩形2323',
    },
    singleWindow: true,
  });
  const long = new LongCapture(screenshots, { interval: 800 });
  screenshots.$view.webContents.openDevTools();

  globalShortcut.register('ctrl+shift+a', () => {
    screenshots.startCapture();
  });

  globalShortcut.register('ctrl+shift+l', async () => {
    await long.start();
  });

  globalShortcut.register('ctrl+shift+s', () => {
    const buffer = long.stop();
    fs.writeFileSync('long.png', buffer);
  });

  screenshots.on('windowCreated', ($win) => {
    $win.on('focus', () => {
      globalShortcut.register('esc', () => {
        if ($win?.isFocused()) {
          screenshots.endCapture();
        }
      });
    });

    $win.on('blur', () => {
      globalShortcut.unregister('esc');
    });
  });

  // 防止不能关闭截图界面
  globalShortcut.register('ctrl+shift+q', () => {
    app.quit();
  });

  // 点击确定按钮回调事件
  screenshots.on('ok', (e, buffer, bounds) => {
    console.log('capture', buffer, bounds);
  });
  // 点击取消按钮回调事件
  screenshots.on('cancel', () => {
    console.log('capture', 'cancel1');
    screenshots.setLang({
      operation_ellipse_title: 'ellipse',
      operation_rectangle_title: 'rectangle',
    });
  });
  // 点击保存按钮回调事件
  screenshots.on('save', (e, buffer, bounds) => {
    console.log('capture', buffer, bounds);
  });

  const mainWin = new BrowserWindow({
    show: true,
  });
  mainWin.removeMenu();
  mainWin.loadURL('https://github.com/nashaofu');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
