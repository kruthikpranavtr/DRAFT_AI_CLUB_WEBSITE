import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerClubQuestion } from '../src/data/chatData.js';

const published={available:{content:true,gallery:true,settings:true},
  content:[
    {type:'event',title:'AI Research Workshop'},
    {type:'achievement',title:'Innovation Award'},
    {type:'project',title:'Campus Accessibility Demo'}
  ],
  gallery:[{id:'photo-1'},{id:'photo-2'}],
  settings:{'contact.email':'club@example.edu'}};
const empty={available:{content:true,gallery:true,settings:true},content:[],gallery:[],settings:{}};
const ask=(q,data=published)=>answerClubQuestion(q,data);

test('published event names, route and no invented hackathon announcements',()=>{
  const answer=ask('Any upcoming hackathons?');
  assert.match(answer.text,/AI Research Workshop/);
  assert.equal(answer.link.href,'/gallery?tab=events');
  assert.doesNotMatch(answer.text,/inter-college hackathon planned/i);
});
test('no invented achievements or event dates when none are published',()=>{
  assert.match(ask('When is the next event?',empty).text,/No event dates are confirmed/);
  assert.match(ask('What awards has AI Club won?',empty).text,/No official achievement entries/);
});
test('if public content is unavailable the bot does not mistake that for an empty collection',()=>{
  const answer=ask('How many photos?',{available:{gallery:false}});
  assert.match(answer.text,/couldn't verify/);
});
test('published gallery count and public contact email are used',()=>{
  assert.match(ask('Show gallery photos').text,/2 published gallery photos/);
  assert.match(ask('What is the contact email?').text,/club@example.edu/);
});
test('student exams and passwords are not disclosed',()=>{
  const password=ask('What is my password?');
  assert.match(password.text,/can't read or reset passwords/);
  assert.equal(password.link.href,'/login');
  assert.match(ask('How can I view draft exams?').text,/only after an authorized admin publishes/);
});
test('unknown queries fail safely',()=>{
  assert.match(ask('Tell me the school mascot birthday?').text,/enough verified information/);
});
test('both UIs use the shared engine and standalone chat route exists',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const home=readFileSync(new URL('../src/pages/HomePage.jsx',import.meta.url),'utf8');
  const full=readFileSync(new URL('../src/pages/ChatPage.jsx',import.meta.url),'utf8');
  assert.match(app,/<Route path="\/chat" element=\{<ChatPage/);
  assert.match(home,/answerClubQuestion\(text,knowledge\)/);
  assert.match(full,/answerClubQuestion\(question,knowledge\)/);
  assert.doesNotMatch(home,/KB\.find/);
});
