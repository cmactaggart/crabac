import { contextBridge, ipcRenderer } from 'electron';

// Add a draggable region at the top of the window for macOS hidden titlebar
if (process.platform === 'darwin') {
  window.addEventListener('DOMContentLoaded', () => {
    const dragBar = document.createElement('div');
    dragBar.style.cssText =
      'position:fixed;top:0;left:0;right:0;height:28px;-webkit-app-region:drag;z-index:99999;pointer-events:auto;';
    document.body.appendChild(dragBar);
  });
}

// Expose a typed API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  showNotification: (title: string, body: string) => {
    ipcRenderer.send('show-notification', { title, body });
  },
});

// Override the web Notification constructor so that `new Notification(title, { body })`
// in the web app routes through Electron's native notifications instead.
contextBridge.exposeInMainWorld('Notification', class ElectronNotification {
  static permission: string = 'granted';
  static requestPermission(): Promise<string> {
    return Promise.resolve('granted');
  }

  constructor(title: string, options?: { body?: string }) {
    ipcRenderer.send('show-notification', {
      title,
      body: options?.body ?? '',
    });
  }
});
