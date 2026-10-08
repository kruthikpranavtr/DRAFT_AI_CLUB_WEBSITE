import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ArrowRight } from 'lucide-react';

export default function TerminalPreview() {
  const [lines, setLines] = useState([]);
  const hasStartedRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const dialog = [
      { who: 'u', prefix: '> user      :', text: 'What does the AI Club do?' },
      { who: 'b', prefix: '> assistant :', text: 'We build AI/ML projects, run hackathons and host weekly workshops. Ask me about events, projects or how to join.' }
    ];

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      setLines(dialog.map(d => ({ ...d, current: d.text })));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasStartedRef.current) {
        hasStartedRef.current = true;
        startTyping();
        observer.disconnect();
      }
    }, { threshold: 0.3 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    function startTyping() {
      let currentLineIdx = 0;
      let charIdx = 0;

      setLines([{ who: dialog[0].who, prefix: dialog[0].prefix, current: '' }]);

      const interval = setInterval(() => {
        const item = dialog[currentLineIdx];
        if (!item) {
          clearInterval(interval);
          return;
        }

        if (charIdx <= item.text.length) {
          const sliced = item.text.slice(0, charIdx);
          setLines(prev => {
            const copy = [...prev];
            copy[currentLineIdx] = { ...item, current: sliced };
            return copy;
          });
          charIdx++;
        } else {
          currentLineIdx++;
          charIdx = 0;
          if (currentLineIdx < dialog.length) {
            setLines(prev => [...prev, { who: dialog[currentLineIdx].who, prefix: dialog[currentLineIdx].prefix, current: '' }]);
          } else {
            clearInterval(interval);
          }
        }
      }, 20);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="term rv" ref={containerRef}>
      <div className="term-bar">
        <i />
        <i />
        <i />
        <span>AICLUB-ASSISTANT · DEMO</span>
      </div>
      <div className="term-body" id="term">
        {lines.map((l, idx) => (
          <div key={idx} className={`tl-${l.who}`}>
            <span className="pfx">{l.prefix}</span> {l.current}
          </div>
        ))}
      </div>
      <div
        className="term-foot"
        style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.15)',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <span className="mono" style={{ fontSize: '11px', color: 'var(--faint)' }}>
          INTERACTIVE PREVIEW
        </span>
        <Link
          className="btn btn-gho btn-sm"
          to="/chat?q=What+does+the+AI+Club+do%3F"
        >
          <MessageSquare size={14} /> Open in AI Chat <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
