import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Send,
  User,
  Bot,
  Trash2,
  MessageCircle,
  ArrowUpRight,
  Calendar,
  Award,
  Image,
  Users,
  Lock,
  Mail,
  Sparkles
} from 'lucide-react';

import { KB, FALLBACK, SUGGESTIONS } from '../data/chatData';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);
  const initialHandledRef = useRef(false);

  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'calendar':
        return <Calendar size={14} />;
      case 'award':
        return <Award size={14} />;
      case 'image':
        return <Image size={14} />;
      case 'users':
        return <Users size={14} />;
      case 'lock':
        return <Lock size={14} />;
      case 'mail':
        return <Mail size={14} />;
      case 'sparkles':
        return <Sparkles size={14} />;
      default:
        return <ArrowUpRight size={14} />;
    }
  };

  const getTimeString = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const streamBotMessage = (fullText, link) => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const msgId = Date.now();

    if (isReduced) {
      setMessages((prev) => [
        ...prev,
        { id: msgId, who: 'bot', text: fullText, link, time: getTimeString() }
      ]);
      setIsTyping(false);
      return;
    }

    let charIndex = 0;
    setMessages((prev) => [
      ...prev,
      { id: msgId, who: 'bot', text: '', link: null, time: getTimeString() }
    ]);

    const interval = setInterval(() => {
      charIndex += 2;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, text: fullText.slice(0, charIndex) } : m
        )
      );

      if (charIndex >= fullText.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, link } : m))
        );
        setIsTyping(false);
      }
    }, 14);
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping) return;

    setInputValue('');
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), who: 'user', text, time: getTimeString() }
    ]);

    setIsTyping(true);

    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));

    const lower = text.toLowerCase();
    const hit = KB.find((entry) => entry.k.some((keyword) => lower.includes(keyword)));

    if (hit) {
      streamBotMessage(hit.r, hit.link || null);
    } else {
      streamBotMessage(FALLBACK, null);
    }
  };

  // Initial welcome message or ?q= query param
  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;

    const query = searchParams.get('q');
    if (query) {
      handleSendMessage(query);
    } else {
      streamBotMessage(
        "Hi! I'm the AI Club Assistant. I can tell you about our projects, hackathons, workshops, achievements, visual gallery, or how to get involved. What would you like to know?",
        null
      );
    }
  }, [searchParams]);

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        who: 'bot',
        text: 'Chat cleared. Ask me anything about the AI Club.',
        time: getTimeString(),
        link: null
      }
    ]);
  };

  return (
    <div className="chat-layout">
      <main className="chat-main">
        <div className="chat-head">
          <div className="chat-status">
            <span className="status-dot" />
            <span>AI CLUB ASSISTANT · ONLINE</span>
          </div>

          <div className="chat-actions">
            <button
              className="icon-btn"
              onClick={handleClearChat}
              title="Clear Chat"
              aria-label="Clear chat history"
              style={{ width: '34px', height: '34px' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="msgs" id="msgs">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <MessageCircle size={42} />
              <b>Start the conversation</b>
              <p>Ask about projects, events, hackathons, workshops — or how to join the club.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`row ${m.who}`}>
                <span className="m-av" aria-hidden="true">
                  {m.who === 'user' ? <User size={16} /> : <Bot size={16} />}
                </span>
                <div className="bubble">
                  {m.text}

                  {m.link && (
                    <div className="b-action">
                      {m.link.href.startsWith('/') ? (
                        <Link className="btn" to={m.link.href}>
                          {getIconComponent(m.link.icon)} {m.link.label}
                        </Link>
                      ) : (
                        <a className="btn" href={m.link.href}>
                          {getIconComponent(m.link.icon)} {m.link.label}
                        </a>
                      )}
                    </div>
                  )}

                  <span className="b-time">
                    {m.who === 'user' ? 'YOU' : 'AI CLUB ASSISTANT'} · {m.time}
                  </span>
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="row bot" id="typingRow">
              <span className="m-av">
                <Bot size={16} />
              </span>
              <div className="bubble">
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}

          <div ref={msgsEndRef} />
        </div>

        {/* Suggestions */}
        <div className="sugs" id="sugs">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              className="sug"
              type="button"
              onClick={() => handleSendMessage(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <form
          className="inp-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            id="chatInput"
            placeholder="Ask something about the AI Club…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
            maxLength={300}
            autoComplete="off"
            aria-label="Type your message"
          />
          <button
            className="send"
            type="submit"
            disabled={isTyping || !inputValue.trim()}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>

        <p className="disclaimer">
          FRONTEND DEMO · PREDEFINED AI KNOWLEDGE BASE · READY FOR LIVE LLM BACKEND INTEGRATION
        </p>
      </main>
    </div>
  );
}
