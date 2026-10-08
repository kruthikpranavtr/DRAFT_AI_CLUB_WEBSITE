import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, MessageSquare, Send, X, Sparkles } from 'lucide-react';
import { KB, FALLBACK, SUGGESTIONS } from '../data/chatData';

const heroTransitionFrames = [
  '/scroll-frames/frame_001.webp',
  '/scroll-frames/frame_002.png',
  '/scroll-frames/frame_003.png',
  '/scroll-frames/frame_004.png',
  '/scroll-frames/frame_006.png',
  '/scroll-frames/frame_009.png',
  '/scroll-frames/frame_011.png',
];

const panels = [
  {
    id: 'home',
    index: '01',
    eyebrow: 'AI CLUB · SRI SHAKTHI',
    title: <>Building the future<br/><em>with AI.</em></>,
    body: 'Learn, build, research and create with a student community exploring what artificial intelligence can become.',
    image: '/scroll-frames/frame_001.webp',
    align: 'left',
    tone: 'hero',
  },
  {
    id: 'discover',
    index: '02',
    eyebrow: 'DISCOVER',
    title: <>Curiosity becomes<br/><em>capability.</em></>,
    body: 'Workshops, paper discussions and hands-on sessions help members move from curiosity to practical understanding.',
    image: '/scroll-frames/frame_011.png',
    align: 'left',
    tone: 'cyan',
  },
  {
    id: 'create',
    index: '03',
    eyebrow: 'CREATE',
    title: <>Ideas become<br/><em>working systems.</em></>,
    body: 'Student teams experiment with models, agents, computer vision and generative AI — turning concepts into things people can use.',
    image: '/scroll-frames/frame_121.webp',
    align: 'right',
    tone: 'teal',
  },
  {
    id: 'connect',
    index: '04',
    eyebrow: 'CONNECT',
    title: <>Grow together.<br/><em>Build what comes next.</em></>,
    body: 'Projects, events, research and people come together as one open network for students who want to shape the future of AI.',
    image: '/scroll-frames/frame_181.webp',
    align: 'left',
    tone: 'gold',
  },
];

function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi — I'm the AI Club assistant. Ask me about projects, events, workshops or the club." }
  ]);
  const [input, setInput] = useState('');

  const ask = (value) => {
    const text = value.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    const match = KB.find(item => item.k.some(k => lower.includes(k)));
    setMessages(prev => [...prev, { role: 'user', text }, { role: 'assistant', text: match?.r || FALLBACK }]);
    setInput('');
  };

  if (!open) return null;
  return (
    <div className="ai-chat-backdrop" onMouseDown={onClose}>
      <aside className="ai-chat-panel" onMouseDown={e => e.stopPropagation()} aria-label="AI Club chat">
        <div className="ai-chat-head">
          <div><Sparkles size={16}/><span>AI CLUB ASSISTANT</span></div>
          <button onClick={onClose} aria-label="Close AI chat"><X size={18}/></button>
        </div>
        <div className="ai-chat-messages">
          {messages.map((m, i) => <div key={i} className={'ai-msg '+m.role}>{m.text}</div>)}
        </div>
        <div className="ai-chat-suggestions">
          {SUGGESTIONS.slice(0, 3).map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}
        </div>
        <form className="ai-chat-form" onSubmit={e => { e.preventDefault(); ask(input); }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask the AI Club..." />
          <button type="submit" aria-label="Send"><Send size={17}/></button>
        </form>
      </aside>
    </div>
  );
}

function HomePanel({ panel, children, sectionRef, sharedVisual = false }) {
  return (
    <section
      className={`home-panel home-panel--${panel.align} home-panel--${panel.tone}${sharedVisual ? ' home-panel--shared' : ''}`}
      id={panel.id}
      ref={sectionRef}
    >
      {!sharedVisual && (
        <>
          <div className="home-panel-media" aria-hidden="true">
            <img src={panel.image} alt="" loading="eager" decoding="async" />
          </div>
          <div className="home-panel-vignette" aria-hidden="true" />
          <div className="home-panel-noise" aria-hidden="true" />
        </>
      )}

      <div className="home-panel-inner">
        <div className="home-panel-copy">
          <div className="home-panel-meta">
            <span className="home-panel-number">{panel.index}</span>
            <span className="home-panel-rule" />
            <span>{panel.eyebrow}</span>
          </div>
          <h1>{panel.title}</h1>
          <p>{panel.body}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

function HeroDiscoverPair({ onChat }) {
  const heroRef = useRef(null);
  const discoverRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const discover = discoverRef.current;
    const canvas = canvasRef.current;
    if (!hero || !discover || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decoded = [];
    const images = heroTransitionFrames.map((src, frame) => {
      const img = new Image();
      img.decoding = 'async';
      img.fetchPriority = frame === 0 ? 'high' : 'auto';
      img.src = src;
      return img;
    });
    let raf = 0;
    let disposed = false;
    let displayedFrame = -1;

    const drawCover = (frame) => {
      const img = images[frame];
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      const resized = canvas.width !== width || canvas.height !== height;
      if (displayedFrame === frame && !resized) return;
      if (resized) {
        canvas.width = width;
        canvas.height = height;
      }

      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const sw = width / scale;
      const sh = height / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      displayedFrame = frame;
      // Expose the frame actually painted, also useful when inspecting slow loads.
      canvas.dataset.frame = heroTransitionFrames[frame];
    };

    const render = () => {
      raf = 0;
      if (disposed) return;
      const heroTop = hero.getBoundingClientRect().top;
      const discoverTop = discover.getBoundingClientRect().top;
      // Only the real distance from Hero's top to Discover's top drives frames.
      // Discover's height and the background track never add animation travel.
      const travel = Math.max(1, discoverTop - heroTop);
      const progress = Math.max(0, Math.min(1, -heroTop / travel));
      const frameProgress = motionPreference.matches ? 0 : progress;
      const frame = Math.round(frameProgress * (images.length - 1));
      // Retain the last valid image until the requested frame is decoded.
      const readyFrame = decoded[frame] ? frame : displayedFrame;
      if (readyFrame >= 0) drawCover(readyFrame);
    };

    const schedule = () => {
      if (!disposed && !raf) raf = requestAnimationFrame(render);
    };

    images.forEach(async (img, frame) => {
      try {
        await img.decode();
        if (disposed) return;
        decoded[frame] = true;
        schedule();
      } catch {
        // The static Hero fallback / last painted frame stays visible on failure.
      }
    });

    const observer = new ResizeObserver(schedule);
    observer.observe(hero);
    observer.observe(discover);
    observer.observe(canvas);
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    motionPreference.addEventListener('change', schedule);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      motionPreference.removeEventListener('change', schedule);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="hero-discover-pair">
      <div className="hero-discover-pair__background" aria-hidden="true">
        <div className="hero-discover-pair__visual">
          <canvas ref={canvasRef} className="hero-discover-pair__canvas" />
          <div className="home-panel-vignette" />
          <div className="home-panel-noise" />
        </div>
      </div>

      <HomePanel panel={panels[0]} sectionRef={heroRef} sharedVisual>
        <div className="home-panel-actions">
          <a className="cin-btn primary" href="#discover">Explore the Club <ArrowRight size={17}/></a>
          <button className="cin-btn ghost" onClick={onChat}>AI Chat <MessageSquare size={17}/></button>
        </div>
        <div className="home-scroll-cue"><ArrowDown size={15}/><span>SCROLL TO EXPLORE</span></div>
      </HomePanel>

      <HomePanel panel={panels[1]} sectionRef={discoverRef} sharedVisual>
        <div className="home-feature-grid">
          <article><span>01</span><strong>Learn</strong><p>Workshops, paper clubs and practical AI sessions.</p></article>
          <article><span>02</span><strong>Experiment</strong><p>Try ideas quickly and understand how modern AI behaves.</p></article>
          <article><span>03</span><strong>Discuss</strong><p>Share findings, challenge assumptions and learn with peers.</p></article>
        </div>
      </HomePanel>
    </div>
  );
}

export default function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);
  const flowRef = useRef(null);

  useEffect(() => {
    const root = flowRef.current;
    if (!root) return undefined;

    const sections = [...root.querySelectorAll('.home-panel:not(.home-panel--shared)')];
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight || 1;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const visible = rect.bottom > vh * 0.14 && rect.top < vh * 0.86;
        section.classList.toggle('is-visible', visible);
      });
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <main className="cin-page normal-home" ref={flowRef}>
      <HeroDiscoverPair onChat={() => setChatOpen(true)} />

      <HomePanel panel={panels[2]}>
        <div className="home-panel-actions">
          <a className="cin-btn primary" href="/gallery">See the Gallery <ArrowRight size={17}/></a>
          <a className="cin-btn ghost" href="/about">Completed Projects <ArrowRight size={17}/></a>
        </div>
        <div className="home-inline-note">
          <span>BUILD</span><span>RESEARCH</span><span>SHIP</span>
        </div>
      </HomePanel>

      <HomePanel panel={panels[3]}>
        <div className="home-panel-actions">
          <a className="cin-btn primary" href="/about">Meet the Club <ArrowRight size={17}/></a>
          <a className="cin-btn ghost" href="/news">Latest News <ArrowRight size={17}/></a>
          <button className="cin-btn ghost" onClick={() => setChatOpen(true)}>AI Chat <MessageSquare size={17}/></button>
        </div>
      </HomePanel>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </main>
  );
}
