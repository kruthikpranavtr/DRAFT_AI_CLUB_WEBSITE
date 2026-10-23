import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/HomePage.jsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');

test('sitewide launcher reuses existing chatbot and exact future GIF path',()=>{
  assert.match(app,/import HomePage, \{ ChatPanel \} from '\.\/pages\/HomePage'/);
  assert.match(app,/<ChatPanel open=\{chatOpen\} onClose=\{\(\)=>setChatOpen\(false\)\}\/>/);
  assert.match(app,/src="\/images\/panda-chatbot\.gif"/);
  assert.match(app,/onClick=\{\(\)=>setChatOpen\(open=>!open\)\}/);
  assert.match(home,/export function ChatPanel/);
  assert.match(home,/aiclub:open-chat/);
  assert.doesNotMatch(home,/<ChatPanel open=\{chatOpen\}/);
});

test('launcher accessibility, transparency and responsive CSS',()=>{
  assert.match(app,/aria-label=\{chatOpen\?'Close AI chat':'Open AI chat'\}/);
  assert.match(app,/aria-expanded=\{chatOpen\}/);
  assert.match(app,/aria-controls="site-ai-chat-panel"/);
  assert.match(home,/id="site-ai-chat-panel"/);
  assert.match(styles,/\.ai-panda-launcher \{[^}]*width: 115px;[^}]*height: 115px;/s);
  assert.match(styles,/\.ai-panda-launcher \{[^}]*background: transparent;[^}]*border: 0;[^}]*box-shadow: none;/s);
  assert.match(styles,/@media \(max-width: 600px\)[\s\S]*\.ai-panda-launcher \{ width: 90px; height: 90px;/);
});

test('the original animation asset is a looping 256px GIF',()=>{
  const gif=readFileSync(new URL('../public/images/panda-chatbot.gif',import.meta.url));
  assert.equal(gif.subarray(0,6).toString('ascii'),'GIF89a');
  assert.equal(gif.readUInt16LE(6),256);
  assert.equal(gif.readUInt16LE(8),256);
  assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')),'looping GIF extension missing');
  assert.ok(gif.length>100000,'animated asset unexpectedly small');
});
test('the panda is available on authenticated student and admin routes without adding the public navbar',()=>{
  assert.match(app,/const \{ session \} = useAuth\(\)/);
  assert.match(app,/pathname\.startsWith\('\/student\/'\) && session\?\.role === 'student'/);
  assert.match(app,/pathname\.startsWith\('\/admin\/'\) && pathname !== '\/admin\/login' && session\?\.role === 'admin'/);
  assert.match(app,/!session\?\.must_change_password/);
  assert.match(app,/const showChat = !standalone \|\| canChatInWorkspace/);
  assert.match(app,/\{!standalone && <><Navbar\/><SiteAnnouncement\/><\/>\}/);
  assert.match(app,/\{showChat && <>/);
});
