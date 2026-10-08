import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);

  useEffect(() => {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFinePointer || isReduced) return;

    document.documentElement.classList.add('cur-on');
    let mx = -100;
    let my = -100;
    let s = 1;
    let ts = 1;
    let animId;

    const handleMouseMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const HOT = 'a, button, input, textarea, select, label, .gtile, .pcard, .ach-row, .ev-row, .gitem, .chip';
    const handleMouseOver = (e) => {
      if (e.target.closest && e.target.closest(HOT)) {
        ts = 1.9;
      }
    };

    const handleMouseOut = (e) => {
      if (e.target.closest && e.target.closest(HOT)) {
        ts = 1;
      }
    };

    const loop = () => {
      s += (ts - s) * 0.2;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx}px, ${my}px) scale(${s})`;
      }
      animId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);
    animId = requestAnimationFrame(loop);

    return () => {
      document.documentElement.classList.remove('cur-on');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <div ref={dotRef} className="cur-dot" aria-hidden="true" />;
}
