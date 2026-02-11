import { contextBridge, ipcRenderer } from 'electron';

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
