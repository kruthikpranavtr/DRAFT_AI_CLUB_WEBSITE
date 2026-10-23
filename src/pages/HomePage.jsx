import { useState } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import { answerClubQuestion,SUGGESTIONS } from '../data/chatData';
import { useClubKnowledge } from '../lib/useClubKnowledge';
import { Link } from 'react-router-dom';
import ScrollVideoStory from '../components/ScrollVideoStory';
import { usePublishedContent } from '../lib/useCms';

const fallbackPanels = [
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

export function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi — I'm the AI Club assistant. Ask me about projects, events, workshops or the club." }
  ]);
  const [input, setInput] = useState('');
  const knowledge=useClubKnowledge(open);

  const ask = (value) => {
    const text = value.trim();
    if (!text) return;
    const reply=answerClubQuestion(text,knowledge);
    setMessages(prev => [...prev, { role:'user', text }, { role:'assistant', text:reply.text,link:reply.link }]);
    setInput('');
  };

  if (!open) return null;
  return (
    <div className="ai-chat-backdrop" onMouseDown={onClose}>
      <aside id="site-ai-chat-panel" className="ai-chat-panel" onMouseDown={e => e.stopPropagation()} aria-label="AI Club chat">
        <div className="ai-chat-head">
          <div><Sparkles size={16}/><span>AI CLUB ASSISTANT</span></div>
          <button onClick={onClose} aria-label="Close AI chat"><X size={18}/></button>
        </div>
        <div className="ai-chat-messages">
          {messages.map((m, i) => <div key={i} className={'ai-msg '+m.role}>{m.text}{m.link&&<Link className="ai-chat-source" to={m.link.href}>{m.link.label} ?</Link>}</div>)}
        </div>
        <div className="ai-chat-suggestions">
          {SUGGESTIONS.slice(0, 3).map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}
        </div>
        <form className="ai-chat-form" onSubmit={e => { e.preventDefault(); ask(input); }}>
          <input value={input} maxLength={300} aria-label="Ask the AI Club assistant" onChange={e => setInput(e.target.value)} placeholder="Ask the AI Club..." />
          <button type="submit" aria-label="Send"><Send size={17}/></button>
        </form>
      </aside>
    </div>
  );
}

export default function HomePage() {
  const { items } = usePublishedContent({ page:'home',type:'page-section' });
  const panels = items.length ? items.map(item => ({
    id:item.section_key,
    index:item.payload.index || String(item.sort_order + 1).padStart(2,'0'),
    eyebrow:item.excerpt,
    title:item.title,
    body:item.body,
    align:item.payload.align || 'left',
    tone:item.payload.tone || 'cyan',
  })) : fallbackPanels;
  return (
    <main className="cin-page video-home">
      <ScrollVideoStory panels={panels} onChat={() => window.dispatchEvent(new Event('aiclub:open-chat'))} />
    </main>
  );
}

