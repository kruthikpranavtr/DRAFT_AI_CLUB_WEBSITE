// Verifies portable demo identities in headless Chrome without consuming attempts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root=path.resolve('docs/demo-account-evidence');
fs.mkdirSync(root,{recursive:true});
const base='http://127.0.0.1:5175';
const browser=await chromium.launch({
  executablePath:process.platform==='win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : process.env.CHROME_BIN || undefined,
  headless:true,args:['--no-sandbox'],
});
let errors=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(response.status()>=400 &&
      !(response.status()===401&&new URL(response.url()).pathname==='/api/auth/me')) {
      errors.push('HTTP '+response.status()+' '+response.url());
    }
  });
  async function login(username,password) {
    await page.goto(base+'/login');
    await page.getByLabel('Roll number, admin ID, or email').fill(username);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:/Sign in/i}).click();
  }
  async function capture(name,width) {
    await page.setViewportSize({width,height:900});
    const result=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(result.width<=result.viewport,'Overflow in '+name+': '+JSON.stringify(result));
    await page.screenshot({path:path.join(root,name+'.png'),fullPage:true});
  }

  await page.goto(base+'/login');
  await page.getByText('LOCAL DEMO ACCOUNTS').waitFor();
  await login('DEMO-ADMIN','DemoAdmin@2026!');
  await page.waitForURL('**/admin/dashboard');
  await page.goto(base+'/admin/assessments');
  await page.getByRole('heading',{name:'Assessments.'}).waitFor();
  await page.getByText('Demo — AI Fundamentals Quiz').waitFor();
  await capture('demo-admin-1440',1440);
  await capture('demo-admin-390',390);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.waitForURL('**/login');

  await login('DEMO-STUDENT','DemoStudent@2026!');
  await page.waitForURL('**/student/dashboard');
  await page.goto(base+'/student/assessments');
  await page.getByText('Demo — AI Fundamentals Quiz').waitFor();
  await page.getByText('Start assessment').waitFor();
  const response=await page.request.get(base+'/api/assessments/student');
  assert.equal(response.status(),200);
  const payload=await response.json();
  assert.ok(payload.items.some(item=>item.title==='Demo — AI Fundamentals Quiz'));
  const forbidden=await page.request.get(base+'/api/assessments/admin');
  assert.equal(forbidden.status(),403);
  await capture('demo-student-1440',1440);
  await capture('demo-student-390',390);
  await context.close();
  assert.deepEqual(errors,[]);
  console.log('DEMO BROWSER PASS: admin and student signed in with fixed portable credentials.');
  console.log('Sample assessment visible, student admin API denied, no viewport overflow or page errors.');
  console.log('Screenshots saved to docs/demo-account-evidence.');
} finally {
  await browser.close();
}
