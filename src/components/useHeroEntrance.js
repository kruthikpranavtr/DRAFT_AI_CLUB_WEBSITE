import { useEffect } from 'react';

export default function useHeroEntrance(scopeRef, enabled = true) {
  useEffect(() => {
    if (!enabled || !scopeRef.current) return;
    const elements = [...scopeRef.current.querySelectorAll('.hero-appear')];
    const finish = element => element.classList.add('is-in');
    const handlers = elements.map(element => {
      const handler = event => {
        if (event.target !== element) return;
        finish(element);
        element.removeEventListener('animationend', handler);
      };
      element.addEventListener('animationend', handler);
      return [element, handler];
    });
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        for (const element of elements) {
          const animations = element.getAnimations?.() || [];
          if (!animations.some(animation => ['running', 'finished'].includes(animation.playState))) finish(element);
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      handlers.forEach(([element, handler]) => element.removeEventListener('animationend', handler));
    };
  }, [scopeRef, enabled]);
}
