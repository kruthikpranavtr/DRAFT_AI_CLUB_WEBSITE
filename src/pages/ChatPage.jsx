import { useEffect,useRef,useState } from 'react';
import { useSearchParams,Link } from 'react-router-dom';
import { Send,User,Bot,Trash2,ArrowUpRight } from 'lucide-react';
import { answerClubQuestion,SUGGESTIONS } from '../data/chatData';
import { useClubKnowledge } from '../lib/useClubKnowledge';

const now=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const greeting=()=>({id:0,who:'bot',text:"Hi! I'm the AI Club website assistant. Ask me about club activities, joining, gallery, public achievements, or portal access.",time:now()});
export default function ChatPage(){
  const [params]=useSearchParams();
  const knowledge=useClubKnowledge();
  const [messages,setMessages]=useState([greeting]);
  const [input,setInput]=useState('');
  const id=useRef(1),end=useRef(null),initial=useRef(false);
  const answer=text=>{
    const question=String(text||'').trim().slice(0,300);
    if(!question)return;
    const reply=answerClubQuestion(question,knowledge);
    setMessages(old=>[...old,{id:id.current++,who:'user',text:question,time:now()},{id:id.current++,who:'bot',text:reply.text,link:reply.link,time:now()}]);
    setInput('');
  };
  useEffect(()=>{end.current?.scrollIntoView({behavior:'auto',block:'end'});},[messages]);
  useEffect(()=>{
    if(initial.current)return;
    initial.current=true;
    const q=params.get('q');
    if(q)answer(q);
    // Deep-linked questions run once. Later questions use refreshed CMS data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <div className="chat-layout"><main className="chat-main">
    <div className="chat-head">
      <div className="chat-status"><span className="status-dot"/><span>AI CLUB WEBSITE ASSISTANT</span></div>
      <div className="chat-actions"><button className="icon-btn" type="button" onClick={()=>{setMessages([greeting()]);setInput('');}} aria-label="Clear chat history" title="Clear chat"><Trash2 size={16}/></button></div>
    </div>
    <div className="msgs" role="log" aria-label="Chat conversation" aria-live="polite">
      {messages.map(m=><div key={m.id} className={'row '+(m.who==='bot'?'bot':'user')}>
        <span className="m-av" aria-hidden="true">{m.who==='bot'?<Bot size={16}/>:<User size={16}/>}</span>
        <div className="bubble">{m.text}{m.link&&<div className="b-action"><Link className="btn" to={m.link.href}><ArrowUpRight size={14}/> {m.link.label}</Link></div>}
        <span className="b-time">{m.who==='bot'?'AI CLUB ASSISTANT':'YOU'} · {m.time}</span></div>
      </div>)}
      <div ref={end}/>
    </div>
    <div className="sugs" aria-label="Suggested questions">{SUGGESTIONS.map(s=><button className="sug" type="button" key={s} onClick={()=>answer(s)}>{s}</button>)}</div>
    <form className="inp-row" onSubmit={e=>{e.preventDefault();answer(input);}}>
      <input id="chatInput" type="text" value={input} onChange={e=>setInput(e.target.value)} maxLength={300} autoComplete="off" aria-label="Type your message" placeholder="Ask about AI Club..."/>
      <button className="send" type="submit" disabled={!input.trim()} aria-label="Send message"><Send size={18}/></button>
    </form>
    <p className="disclaimer">PUBLIC WEBSITE KNOWLEDGE · AUTOMATED ANSWERS · NOT A LIVE AI MODEL</p>
  </main></div>;
}
