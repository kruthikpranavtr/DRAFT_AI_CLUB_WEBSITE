import { useEffect, useRef, useState } from 'react';

export default function NeuralCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [telemetry, setTelemetry] = useState({
    nodes: 0,
    edges: 0,
    fps: 60
  });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const ctx = cv.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0;
    let H = 0;
    let nodes = [];
    let run = true;
    let last = performance.now();
    let frames = 0;
    let fpsT = last;
    let animId;

    const getAccent = () => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#ff4a4a';
    };
    let accent = getAccent();

    const onThemeChange = () => {
      accent = getAccent();
    };
    window.addEventListener('themechange', onThemeChange);

    const mouse = { x: -9000, y: -9000 };

    function hexA(h, a) {
      if (h.startsWith('rgb')) return h;
      const n = parseInt(h.replace('#', ''), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    function size() {
      if (!cv) return;
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * DPR;
      cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const n = Math.min(110, Math.max(40, Math.floor((W * H) / 15000)));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: Math.random() * 1.6 + 0.9
      }));

      setTelemetry((prev) => ({ ...prev, nodes: n }));
    }

    function step(now) {
      frames++;
      if (now - fpsT > 600) {
        const calculatedFps = Math.round((frames * 1000) / (now - fpsT));
        frames = 0;
        fpsT = now;

        let edgeCount = 0;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            if (dx * dx + dy * dy < 16900) edgeCount++;
          }
        }

        setTelemetry({
          fps: calculatedFps,
          nodes: nodes.length,
          edges: edgeCount
        });
      }

      ctx.clearRect(0, 0, W, H);

      // Render & update nodes
      for (const p of nodes) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dd = Math.hypot(dx, dy);

        if (dd < 150 && dd > 1) {
          p.x += (dx / dd) * 0.7;
          p.y += (dy / dd) * 0.7;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexA(accent, dd < 150 ? 0.9 : 0.5);
        ctx.fill();
      }

      // Render edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;

          if (d2 < 16900) {
            const opacity = (1 - Math.sqrt(d2) / 130) * 0.26;
            ctx.strokeStyle = hexA(accent, opacity);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (run) {
        animId = requestAnimationFrame(step);
      }
    }

    const parent = cv.parentElement;
    const handleMouseMove = (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -9000;
      mouse.y = -9000;
    };

    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
    }

    window.addEventListener('resize', size);

    const observer = new IntersectionObserver((entries) => {
      const isVisible = entries[0].isIntersecting;
      if (isVisible && !run) {
        run = true;
        animId = requestAnimationFrame(step);
      } else if (!isVisible) {
        run = false;
        cancelAnimationFrame(animId);
      }
    });
    observer.observe(cv);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        run = false;
        cancelAnimationFrame(animId);
      } else {
        run = true;
        animId = requestAnimationFrame(step);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    size();
    animId = requestAnimationFrame(step);

    return () => {
      run = false;
      cancelAnimationFrame(animId);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
      window.removeEventListener('resize', size);
      window.removeEventListener('themechange', onThemeChange);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <>
      <canvas id="neural" ref={canvasRef} aria-hidden="true" />
      <div className="hero-tele rv" aria-hidden="true">
        <span>SYS.VITE-REACT</span>
        <span>
          NODES <b>{telemetry.nodes || '—'}</b>
        </span>
        <span>
          EDGES <b>{telemetry.edges || '—'}</b>
        </span>
        <span>
          FPS <b>{telemetry.fps || '—'}</b>
        </span>
        <span className="tele-dot" />
        <span>LIVE CANVAS</span>
      </div>
    </>
  );
}
