import { useState } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import { KB, FALLBACK, SUGGESTIONS } from '../data/chatData';
import ScrollVideoStory from '../components/ScrollVideoStory';

const panels = [
  {
    id: 'home',
    index: '01',
    eyebrow: 'AI CLUB · SRI SHAKTHI',
    title: <><span className="hero-intro__line"><span className="hero-appear hero-appear--mask" style={{ "--d": ".42s" }}>Build with <em className="hero-appear hero-appear--em" style={{ "--d": ".72s" }}>AI.</em></span></span><span className="hero-intro__line"><span className="hero-appear hero-appear--mask" style={{ "--d": ".62s" }}>Shape what comes next.</span></span></>,
    body: 'Learn, build, research and create with a student community exploring what artificial intelligence can become.',
    align: 'left',
    tone: 'hero',
  },
  {
    id: 'discover',
    index: '02',
    eyebrow: 'DISCOVER',
    title: <>Curiosity becomes<br/><em>capability.</em></>,
    body: 'Workshops, paper discussions and hands-on sessions help members move from curiosity to practical understanding.',
    align: 'left',
    tone: 'cyan',
  },
  {
    id: 'create',
    index: '03',
    eyebrow: 'CREATE',
    title: <>Ideas become<br/><em>working systems.</em></>,
    body: 'Student teams experiment with models, agents, computer vision and generative AI — turning concepts into things people can use.',
    align: 'right',
    tone: 'teal',
  },
  {
    id: 'connect',
    index: '04',
    eyebrow: 'CONNECT',
    title: <>Grow together.<br/><em>Build what comes next.</em></>,
    body: 'Projects, events, research and people come together as one open network for students who want to shape the future of AI.',
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

export default function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <main className="cin-page video-home">
      <ScrollVideoStory panels={panels} onChat={() => setChatOpen(true)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </main>
  );
}

