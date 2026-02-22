import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from './useIsMobile.js';
import { useLayoutStore } from '../stores/layout.js';

/**
 * iOS-style swipe navigation for mobile.
 * Swipe right = browser back, swipe left = browser forward.
 * When in chat mobileView, swipe right also resets to sidebar view.
 */
export function useSwipeNavigation() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const mobileView = useLayoutStore((s) => s.mobileView);
  const setMobileView = useLayoutStore((s) => s.setMobileView);

  // Use refs so the touchend handler always reads current values
  const mobileViewRef = useRef(mobileView);
  mobileViewRef.current = mobileView;
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  useEffect(() => {
    if (!isMobile) return;

    let startX = 0;
    let startY = 0;

    function isHorizontallyScrollable(el: EventTarget | null): boolean {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    }

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Must be primarily horizontal
      if (Math.abs(dy) >= Math.abs(dx) * 0.6) return;
      // Must exceed minimum distance
      if (Math.abs(dx) < 75) return;
      // Don't interfere with horizontally scrollable containers
      if (isHorizontallyScrollable(e.target)) return;

      if (dx > 0) {
        // Swipe right → back
        if (mobileViewRef.current === 'chat') {
          setMobileView('sidebar');
        }
        navigate(-1);
      } else {
        // Swipe left → forward
        navigate(1);
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile, navigate, setMobileView]);
}
