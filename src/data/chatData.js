// Public-site knowledge only. Do not add private account data, assessment answers,
// unverified schedules, invented achievements, or administrative credentials.
export const SUGGESTIONS = [
  'What is the AI Club?',
  'How do I join the club?',
  'Are there any upcoming events?',
  'Show me club achievements',
  'How do I log in?',
  'How can I contact the club?'
];

export const FALLBACK = "I can help with AI Club pages, membership, events, achievements, gallery, news, student assessments, and login. I don't have enough verified information to answer that question. For individual account issues, please contact the club administrator.";

const link = (href, label, icon='arrow-up-right') => ({ href, label, icon });
const clean = input => String(input || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const matches = (text, pattern) => pattern.test(text);
const publicItems = (data, type) => (data?.available?.content ? (data.content || []).filter(item => item.type === type) : null);
const titles = (items, max=3) => items.slice(0,max).map(item => String(item.title||'').trim()).filter(Boolean);
const latest = values => values.length ? values.join('; ') : '';

export function answerClubQuestion(query, data={}) {
  const text=clean(query);
  if (!text) return { text:FALLBACK, link:null };
  const contact=link('/#contact','Contact the AI Club','mail');
  if (matches(text,/\b(password|forgot|reset|credentials|secret|otp)\b/)) {
    return {text:"For a forgotten password, contact your club administrator or faculty coordinator. This assistant can't read or reset passwords. Never share your password in chat.",link:link('/login','Open the login page','lock')};
  }
  if (matches(text,/\b(assessment|assessments|quiz|quizzes|exam|exams|test|tests|marks|score|scores)\b/)) {
    return {text:"Student assessments are visible only after an authorized admin publishes them and only for eligible students. Sign in with your student account to see available assessments. Results appear according to the assessment release rules; I can't reveal answer keys.",link:link('/login','Sign in to your student portal','lock')};
  }
  if (matches(text,/\b(login|log in|sign in|signin|portal|roll number|student id|admin id|dashboard|account)\b/)) {
    return {text:"Students sign in with their roll number. Administrators can sign in with their admin ID or email. Your role determines which dashboard you can access. For login problems, contact your administrator.",link:link('/login','Open member login','lock')};
  }
  if (matches(text,/\b(achievement|achievements|award|awards|winner|winners|won|prize|prizes|recognition)\b/)) {
    const items=publicItems(data,'achievement');
    const detail=items===null ? "I couldn't check the latest published achievements right now." : items.length ? "Published highlights: "+latest(titles(items))+"." : "No official achievement entries are published in the current content feed yet.";
    return {text:detail+" You can view the public achievements section for updates.",link:link('/gallery?tab=achievements','View public achievements','award')};
  }
  if (matches(text,/\b(gallery|photo|photos|picture|pictures|images)\b/)) {
    const items=data?.available?.gallery ? data.gallery || [] : null;
    const detail=items===null ? "I couldn't verify the latest gallery uploads right now." : items.length ? "There are "+items.length+" published gallery photo"+(items.length===1?'':'s')+" available." : "No official gallery photos are published in the current feed yet.";
    return {text:detail+" Visit the public Gallery page to browse the collection.",link:link('/gallery','Open Gallery','image')};
  }
  if (matches(text,/\b(event|events|hackathon|hackathons|workshop|workshops|session|sessions|schedule|upcoming|training)\b/)) {
    const items=publicItems(data,'event');
    const detail=items===null ? "I couldn't verify the latest event schedule right now." : items.length ? "Published event listings include: "+latest(titles(items))+"." : "No event dates are confirmed in the published content feed right now. I won't invent a schedule.";
    return {text:detail+" Check the Events view for the latest announcements.",link:link('/gallery?tab=events','See events and workshops','calendar')};
  }
  if (matches(text,/\b(project|projects|prototype|research|build|built|showcase|model)\b/)) {
    const items=publicItems(data,'project');
    const detail=items===null ? "I couldn't verify the current project listings right now." : items.length ? "Published project highlights include: "+latest(titles(items))+"." : "The AI Club explores hands-on AI projects, but there are no individually verified projects in the published content feed yet.";
    return {text:detail+" Visit the club website to learn more about its work.",link:link('/','Explore the club website','sparkles')};
  }
  if (matches(text,/\b(news|announcement|announcements|latest|update|updates)\b/)) {
    return {text:"The News page displays official updates and approved articles. I can't guarantee a specific announcement is current without checking the page.",link:link('/news','Open News','calendar')};
  }
  if (matches(text,/\b(join|joining|member|membership|enroll|enrol|register|registration|apply|application|participate)\b/)) {
    return {text:"AI Club is a student community at Sri Shakthi Institute of Engineering and Technology. For membership requirements, application periods and approvals, check official announcements or contact the club coordinator. I can't confirm a registration window that hasn't been published.",link:link('/#contact','Ask about joining','users')};
  }
  if (matches(text,/\b(contact|email|phone|call|reach|location|address|coordinator|faculty)\b/)) {
    const email=data?.available?.settings && typeof data.settings?.['contact.email']==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.settings['contact.email']) ? data.settings['contact.email'] : null;
    return {text:email ? "The public contact email currently listed for the AI Club is "+email+". You can also use the contact section to find other official channels." : "For verified contact information and faculty-coordinator details, see the website's contact section. I don't have a confirmed phone number to share.",link:contact};
  }
  if (matches(text,/\b(community|discussion|discussions|post|posts|student|team|teams|people|leader|leadership|about)\b/)) {
    return {text:"AI Club brings students together to learn, build, research and discuss AI. The Community area is available to signed-in members; the About page provides the club's public overview.",link:link('/about','About the AI Club','users')};
  }
  if (matches(text,/\b(ai club|ai clubs|artificial intelligence club|your club|the club)\b/)) {
    return {text:"AI Club is the student AI community of Sri Shakthi Institute of Engineering and Technology. Members learn, build and explore AI through projects, discussions and practical activities. Browse the About page for the official club overview.",link:link('/about','Learn about AI Club','users')};
  }
  if (/^(hi|hello|hey|vanakkam|good morning|good afternoon|good evening)\b/.test(text)) {
    return {text:"Hello! I'm the AI Club website assistant. Ask about the club, membership, events, published achievements, Gallery, news, or student login. I use published website information rather than inventing updates.",link:null};
  }
  if (matches(text,/\b(thanks|thank you|thank)\b/)) {
    return {text:"You're welcome! You can ask another AI Club question or open the relevant page.",link:null};
  }
  return {text:FALLBACK,link:contact};
}
