import { useEffect, useRef } from 'react';
import { ArrowRight, MessageSquare } from 'lucide-react';
import './ScrollVideoStory.css';
import HeroIntro from './HeroIntro';

const backgroundVideos = [
  { id: 'home', src: '/hero-particle-ribbon-web.mp4', poster: '/hero-particle-ribbon-poster.jpg' },
  { id: 'discover', src: '/section-discover.mp4', poster: '/section-discover-poster.jpg' },
  { id: 'create', src: '/section-create.mp4', poster: '/section-create-poster.jpg' },
  { id: 'connect', src: '/section-connect.mp4', poster: '/section-connect-poster.jpg' },
];

function SharedStoryBackground({ chapterRefs }) {
  const layerRefs = useRef([]);
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const update = () => {
      frame = 0;
      const chapters = chapterRefs.current.filter(Boolean);
      if (chapters.length !== backgroundVideos.length) return;
      const scroll = window.scrollY;
      const viewport = window.innerHeight;
      let from = chapters.length - 1;
      let to = from;
      let progress = 0;
      for (let index = 1; index < chapters.length; index += 1) {
        const boundary = chapters[index].offsetTop;
        const start = boundary - viewport * 0.72;
        const end = boundary - viewport * 0.28;
        if (scroll < start) {
          from = index - 1;
          to = from;
          break;
        }
        if (scroll <= end) {
          from = index - 1;
          to = index;
          progress = Math.max(0, Math.min(1, (scroll - start) / (end - start)));
          break;
        }
      }
      layerRefs.current.forEach((layer, index) => {
        if (!layer) return;
        const opacity = index === from ? 1 - progress : index === to ? progress : 0;
        layer.style.opacity = String(opacity);
        const video = layer.querySelector('video');
        const shouldPlay = !reducedMotion && opacity > 0.015;
        if (shouldPlay && video.paused) video.play().catch(() => {});
        if (!shouldPlay && !video.paused) video.pause();
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      layerRefs.current.forEach(layer => layer?.querySelector('video')?.pause());
    };
  }, [chapterRefs]);

  return <div className="video-story__shared-background" aria-hidden="true">
    {backgroundVideos.map((video, index) => <div
      className="video-story__shared-layer"
      data-section={video.id}
      key={video.id}
      ref={element => { layerRefs.current[index] = element; }}
      style={{ opacity: index === 0 ? 1 : 0 }}>
      <video src={video.src} poster={video.poster} muted loop playsInline preload={index === 0 ? 'auto' : 'metadata'} tabIndex="-1"/>
    </div>)}
  </div>;
}

export default function ScrollVideoStory({ panels, onChat }) {
  const chapterRefs = useRef([]);
  const goToChapter = index => {
    const section = chapterRefs.current[index];
    if (!section) return;
    window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <section className="video-story" aria-label="AI Club story">
    <SharedStoryBackground chapterRefs={chapterRefs}/>
    {panels.map((panel, index) => <section
      className={'video-story__chapter video-story__chapter--' + panel.align + ' video-story__chapter--' + panel.tone + (index === 0 ? ' video-story__chapter--hero' : '')}
      ref={element => { chapterRefs.current[index] = element; }} id={panel.id} key={panel.id}
      aria-labelledby={'story-title-' + panel.id}>
      {index === 0 ? <HeroIntro panel={panel} onExplore={() => goToChapter(1)} onChat={onChat} status="Scroll to explore"/>
        : <div className="video-story__copy">
          <p className="video-story__eyebrow">{panel.index} / {String(panels.length).padStart(2, '0')} · {panel.eyebrow}</p>
          <h2 id={'story-title-' + panel.id}>{panel.title}</h2>
          <p className="video-story__body">{panel.body}</p>
          <div className="video-story__actions">
            {index < panels.length - 1
              ? <button className="cin-btn primary" onClick={() => goToChapter(index + 1)}>Explore <ArrowRight size={16}/></button>
              : <a className="cin-btn primary" href="/about">Meet the Club <ArrowRight size={16}/></a>}
            <button className="cin-btn ghost" onClick={onChat}>AI Chat <MessageSquare size={16}/></button>
          </div>
        </div>}
    </section>)}
  </section>;
}
