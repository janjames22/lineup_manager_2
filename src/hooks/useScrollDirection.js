import { useState, useEffect, useRef } from 'react';

export function useScrollDirection({ threshold = 10, topOffset = 50 } = {}) {
  const [direction, setDirection] = useState('up'); // 'up' = show, 'down' = hide
  const [atTop, setAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateDirection = () => {
      const scrollY = window.scrollY;

      if (scrollY < topOffset) {
        setAtTop(true);
        setDirection('up');
        lastScrollY.current = scrollY;
        ticking.current = false;
        return;
      }
      setAtTop(false);

      if (Math.abs(scrollY - lastScrollY.current) < threshold) {
        ticking.current = false;
        return;
      }

      setDirection(scrollY > lastScrollY.current ? 'down' : 'up');
      lastScrollY.current = scrollY > 0 ? scrollY : 0;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topOffset]);

  return { direction, atTop, isVisible: direction === 'up' || atTop };
}
