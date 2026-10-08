import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Github, MessageSquare } from 'lucide-react';

export default function Footer({ showAssistantLink = false }) {
  const year = new Date().getFullYear();

  return (
    <footer className="foot-main" id="contact">
      <div className="wrap">
        <div className="foot-top">
          <div className="f-brand">
            <Link className="brand" to="/">
              <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ width: '34px', height: '34px' }}>
                <path d="M16 6 L27 25 L5 25 Z" stroke="var(--line2)" strokeWidth="1.5" />
                <circle cx="16" cy="6" r="3.2" fill="var(--accent)" />
                <circle cx="27" cy="25" r="2.6" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="5" cy="25" r="2.6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="brand-t">
                AI<b>CLUB</b>
                <small>SRI SHAKTHI</small>
              </span>
            </Link>
            <p>The official AI student community of Sri Shakthi Institute of Engineering and Technology.</p>
            <span className="f-tag">STUDENT AI COLLECTIVE — EST. REACT VITE v1.0</span>
          </div>

          <div className="f-col">
            <h4>EXPLORE</h4>
            <Link to="/">Home</Link>
            <a href="/#about">About</a>
            <a href="/#projects">Projects</a>
            <a href="/#events">Events</a>
            <Link to="/gallery">Gallery</Link>
            <Link to="/chat">AI Chat</Link>
            <Link to="/login">Admin Login</Link>
          </div>

          <div className="f-col">
            <h4>CONTACT</h4>
            <span>Sri Shakthi Institute of Engineering and Technology</span>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--faint)' }}>
              email — aiclub@srishakthi.ac.in
            </span>

            {showAssistantLink ? (
              <>
                <h4 style={{ marginTop: '22px' }}>COMMUNITY & ASSISTANT</h4>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <Link className="btn btn-gho btn-sm" to="/chat">
                    <MessageSquare size={15} /> Open AI Assistant
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h4 style={{ marginTop: '22px' }}>SOCIAL</h4>
                <div className="socials">
                  <a
                    className="icon-btn"
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    aria-label="Instagram"
                  >
                    <Instagram size={17} />
                  </a>
                  <a
                    className="icon-btn"
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="LinkedIn"
                    aria-label="LinkedIn"
                  >
                    <Linkedin size={17} />
                  </a>
                  <a
                    className="icon-btn"
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="GitHub"
                    aria-label="GitHub"
                  >
                    <Github size={17} />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="foot-bot">
          <span>© {year} AI CLUB — Sri Shakthi Institute of Engineering and Technology</span>
          <span className="mono">REACT + VITE · HIGH PERFORMANCE ARCHITECTURE</span>
        </div>
      </div>
    </footer>
  );
}
