import { useEffect } from 'react';
import { useNotificationsStore } from '../stores/notifications.js';
import { useDMStore } from '../stores/dm.js';

const BASE_TITLE = 'crab.ac';
const FAVICON_HREF = '/favicon.svg';

let badgeCanvas: HTMLCanvasElement | null = null;

function updateFavicon(count: number) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  if (count === 0) {
    link.href = FAVICON_HREF;
    return;
  }

  // Draw the SVG favicon onto a canvas and add a red badge
  const img = new Image();
  img.onload = () => {
    if (!badgeCanvas) {
      badgeCanvas = document.createElement('canvas');
    }
    const size = 64;
    badgeCanvas.width = size;
    badgeCanvas.height = size;
    const ctx = badgeCanvas.getContext('2d')!;

    // Draw original favicon
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    // Recolor crab to black for contrast with the red badge
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    // Draw red dot in upper-right corner
    const dotRadius = 13;
    const dotX = size - dotRadius - 1;
    const dotY = dotRadius + 1;

    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ed4245';
    ctx.fill();

    // Draw count number if <= 99
    if (count <= 99) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${count > 9 ? 12 : 14}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), dotX, dotY);
    }

    link.href = badgeCanvas.toDataURL('image/png');
  };
  img.src = FAVICON_HREF;
}

export function useTabNotifications() {
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const dmUnreads = useDMStore((s) => s.dmUnreads);

  const dmUnreadCount = Object.values(dmUnreads).reduce((sum, n) => sum + n, 0);
  const totalCount = unreadCount + dmUnreadCount;

  useEffect(() => {
    document.title = totalCount > 0 ? `(${totalCount}) ${BASE_TITLE}` : BASE_TITLE;
    updateFavicon(totalCount);

    return () => {
      document.title = BASE_TITLE;
    };
  }, [totalCount]);
}
