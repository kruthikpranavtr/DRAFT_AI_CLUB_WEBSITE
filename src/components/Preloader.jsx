import { useState, useEffect } from 'react';

export default function Preloader() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDone(true);
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`loader ${done ? 'done' : ''}`} aria-hidden="true">
      <svg className="mark" viewBox="0 0 32 32" fill="none">
        <path d="M16 6 L27 25 L5 25 Z" stroke="var(--line2)" strokeWidth="1.5" />
        <circle cx="16" cy="6" r="3.2" fill="var(--accent)" />
        <circle cx="27" cy="25" r="2.6" stroke="var(--text)" strokeWidth="1.5" />
        <circle cx="5" cy="25" r="2.6" stroke="var(--text)" strokeWidth="1.5" />
      </svg>
      <span>INITIALISING AI CLUB</span>
    </div>
  );
}
