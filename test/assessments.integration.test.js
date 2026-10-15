import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-assessment-'));
process.env.NODE_ENV='test';
process.env.DATABASE_PATH=path.join(root,'assessments.db');
process.env.MIGRATION_BACKUP_DIR=path.join(root,'backups');
process.env.ALLOWED_ORIGINS='http://localhost:5174';
const { db,now }=await import('../server/db.js');
const { createApp }=await import('../server/app.js');
const { hashPassword }=await import('../server/passwords.js');
const { PERMISSIONS }=await import('../server/permissions.js');
const password='Secure-assessment-QA-42!';
for (const [id,member,email,role,permissions] of [
  ['admin','ADMIN-01','admin@assessment.test','admin',[PERMISSIONS.SUPER_ADMIN]],
  ['student','25AM087','student@assessment.test','student',[]],
  ['student-other','25AM088','other@assessment.test','student',[]],
  ['admin-restricted','ADMIN-02','restricted@assessment.test','admin',[]],
]) {
  const time=now();
  db.prepare('INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,member,email,id,await hashPassword(password),role,'active',JSON.stringify(permissions),0,time,time);
}
db.prepare('INSERT INTO student_profiles (user_id,academic_year,created_at,updated_at) VALUES (?,?,?,?)')
  .run('student',2,now(),now());
db.prepare('INSERT INTO student_profiles (user_id,academic_year,created_at,updated_at) VALUES (?,?,?,?)')
  .run('student-other',3,now(),now());

class Client {
  cookies=new Map();
  csrfToken='';
  cookieHeader() {return [...this.cookies].map(([key,value])=>key+'='+value).join('; ');}
  receive(response) {
    for(const value of response.headers.getSetCookie()) {
      const pair=value.split(';')[0],index=pair.indexOf('=');
      if(pair.slice(index+1))this.cookies.set(pair.slice(0,index),pair.slice(index+1));
      else this.cookies.delete(pair.slice(0,index));
    }
  }
  async request(base,route,{method='GET',body,form}={}) {
    const headers={cookie:this.cookieHeader(),origin:'http://localhost:5174'};
    if(body!==undefined)headers['content-type']='application/json';
    if(['POST','PUT','PATCH','DELETE'].includes(method)&&this.csrfToken)headers['x-csrf-token']=this.csrfToken;
    const response=await fetch(base+route,{method,headers,...(form?{body:form}:body===undefined?{}:{body:JSON.stringify(body)})});
    this.receive(response);
    const type=response.headers.get('content-type')||'';
    const data=type.includes('json')?await response.json():await response.arrayBuffer();
    return {status:response.status,data};
  }
  async login(base,identifier) {
    this.csrfToken=(await this.request(base,'/api/auth/csrf')).data.csrfToken;
    const result=await this.request(base,'/api/auth/login',{method:'POST',body:{identifier,password}});
    assert.equal(result.status,200);
  }
}
const admin=new Client(),student=new Client(),other=new Client(),restricted=new Client(),anon=new Client();
const bankPath='/api/assessments/admin/banks';
const adminPath='/api/assessments/admin';
const studentPath='/api/assessments/student';
function data(body){return {method:'POST',body};}
function assessmentBody(bankId,kind='mcq') {
  return {title:kind==='mcq'?'MCQ Test':'Coding Test',description:'QA test',instructions:'Test instructions',
    kind,bankId,questionCount:kind==='mcq'?2:1,questionIds:[],allowBackward:false,
    pointsMode:kind==='mcq'?'equal':'custom',totalPoints:kind==='mcq'?4:5,durationMinutes:30,
    startAt:null,endAt:null,attemptLimit:1,eligibilityYear:2};
}
test('MCQ assessment, Excel preview, role gates, immutable snapshots, attempts and hidden results',async()=>{
  const server=createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    await Promise.all([admin.login(base,'ADMIN-01'),student.login(base,'25AM087'),other.login(base,'25AM088'),restricted.login(base,'ADMIN-02')]);
    assert.equal((await anon.request(base,adminPath)).status,401);
    assert.equal((await student.request(base,adminPath)).status,403);
    assert.equal((await restricted.request(base,bankPath,data({title:'Unauthorized'}))).status,403);
    let result=await admin.request(base,bankPath,data({title:'Year 2 Bank',academicYear:2,batch:'2025-2029',description:''}));
    assert.equal(result.status,201);const bankId=result.data.id;
    const questionA={kind:'mcq',prompt:'What does AI mean?',options:['Artificial Intelligence','A','B','C'],correctOption:0,points:2,language:'',externalUrl:''};
    const questionB={kind:'mcq',prompt:'Which is Python?',options:['A snake only','A language','A browser','A laptop'],correctOption:1,points:2,language:'',externalUrl:''};
    for(const question of [questionA,questionB]) {
      result=await admin.request(base,bankPath+'/'+bankId+'/questions',data(question));
      assert.equal(result.status,201);
    }
    let questions=(await admin.request(base,bankPath+'/'+bankId+'/questions')).data.items;
    assert.equal(questions.length,2);
    // A real .xlsx buffer is parsed and previewed, without changing the question bank.
    const workbook=new ExcelJS.Workbook();
    const sheet=workbook.addWorksheet('Questions');
    sheet.addRow(['Question','Option A','Option B','Option C','Option D','Correct Answer','Points','Type','Language','External URL']);
    sheet.addRow(['What is ML?','Machine Learning','A','B','C','A',2,'mcq','','']);
    const form=new FormData();
    form.set('file',new Blob([await workbook.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'qa.xlsx');
    result=await admin.request(base,bankPath+'/'+bankId+'/import-preview',{method:'POST',form});
    assert.equal(result.status,200);assert.equal(result.data.count,1);
    assert.equal((await admin.request(base,bankPath+'/'+bankId+'/questions')).data.items.length,2);
    result=await admin.request(base,bankPath+'/'+bankId+'/import',{method:'POST',form});
    assert.equal(result.status,201);
    assert.equal((await admin.request(base,bankPath+'/'+bankId+'/questions')).data.items.length,3);
    result=await admin.request(base,bankPath+'/'+bankId+'/import-preview',{method:'POST',form});
    assert.equal(result.status,400,'duplicate Excel questions are rejected');
    assert.equal(result.data.issues[0].row,2);
    const invalid={...assessmentBody(bankId),pointsMode:'custom',totalPoints:3};
    assert.equal((await admin.request(base,adminPath,data(invalid))).status,400);
    result=await admin.request(base,adminPath,data(assessmentBody(bankId)));
    assert.equal(result.status,201);const assessmentId=result.data.id;
    assert.equal((await student.request(base,studentPath)).data.items.length,0);
    assert.equal((await admin.request(base,adminPath+'/'+assessmentId+'/publish',{method:'POST'})).status,200);
    await admin.request(base,bankPath+'/'+bankId+'/questions/'+questions[0].id,
      {method:'PUT',body:{...questionA,prompt:'Edited after publishing',correctOption:3}});
    const snapshot=(await admin.request(base,adminPath+'/'+assessmentId)).data.questions;
    assert.equal(snapshot[0].prompt,'What does AI mean?');
    assert.equal(snapshot[0].correctOption,0);
    assert.equal((await other.request(base,studentPath)).data.items.length,0,'year-based eligibility');
    assert.equal((await student.request(base,studentPath)).data.items.length,1);
    result=await student.request(base,studentPath+'/'+assessmentId+'/start',{method:'POST'});
    assert.equal(result.status,201);
    const attemptId=result.data.attempt.id;
    let current=(await student.request(base,studentPath+'/attempts/'+attemptId)).data;
    assert.equal(current.questions[0].prompt,'What does AI mean?');
    assert.equal(current.questions[1].locked,true);
    assert.equal('correctOption' in current.questions[0],false);
    assert.equal((await student.request(base,studentPath+'/attempts/'+attemptId+'/answers/'+current.questions[1].id,
      {method:'PUT',body:{selectedOption:0}})).status,403,'future question blocked');
    assert.equal((await student.request(base,studentPath+'/attempts/'+attemptId+'/answers/'+current.questions[0].id,
      {method:'PUT',body:{selectedOption:0}})).status,200);
    assert.equal((await student.request(base,studentPath+'/attempts/'+attemptId+'/advance',{method:'POST'})).status,200);
    assert.equal((await student.request(base,studentPath+'/attempts/'+attemptId+'/answers/'+current.questions[0].id,
      {method:'PUT',body:{selectedOption:3}})).status,403,'backtracking blocked');
    current=(await student.request(base,studentPath+'/attempts/'+attemptId)).data;
    assert.equal(current.questions[0].locked,true);
    assert.equal(current.questions[1].prompt,'Which is Python?');
    await student.request(base,studentPath+'/attempts/'+attemptId+'/answers/'+current.questions[1].id,{method:'PUT',body:{selectedOption:1}});
    result=await student.request(base,studentPath+'/attempts/'+attemptId+'/submit',{method:'POST'});
    assert.equal(result.status,200);assert.equal(result.data.attempt.score,null,'hidden before admin publication');
    assert.equal((await student.request(base,studentPath+'/attempts/'+attemptId)).data.attempt.score,null);
    assert.equal((await admin.request(base,adminPath+'/'+assessmentId+'/release-results',{method:'POST'})).status,409);
    assert.equal((await admin.request(base,adminPath+'/'+assessmentId+'/close',{method:'POST'})).status,200);
    assert.equal((await admin.request(base,adminPath+'/'+assessmentId+'/release-results',{method:'POST'})).status,200);
    assert.equal((await student.request(base,studentPath+'/attempts/'+attemptId)).data.attempt.score,4);
    assert.equal((await student.request(base,studentPath+'/'+assessmentId+'/start',{method:'POST'})).status,409);
    assert.equal(db.prepare('SELECT count(*) n FROM assessment_attempts').get().n,1);

    // Coding submissions require administrator marking before results can be released.
    result=await admin.request(base,bankPath,data({title:'Coding Bank',academicYear:2,batch:'2025-2029',description:''}));
    const codingBank=result.data.id;
    result=await admin.request(base,bankPath+'/'+codingBank+'/questions',data({
      kind:'coding',prompt:'Return the sum of two inputs',points:5,language:'Python',externalUrl:'https://www.hackerrank.com/challenges/simple-array-sum'
    }));
    assert.equal(result.status,201);
    result=await admin.request(base,adminPath,data(assessmentBody(codingBank,'coding')));
    assert.equal(result.status,201);const codeAssessment=result.data.id;
    await admin.request(base,adminPath+'/'+codeAssessment+'/publish',{method:'POST'});
    const started=await student.request(base,studentPath+'/'+codeAssessment+'/start',{method:'POST'});
    const codeAttempt=started.data.attempt.id;
    const codeQuestion=(await student.request(base,studentPath+'/attempts/'+codeAttempt)).data.questions[0];
    await student.request(base,studentPath+'/attempts/'+codeAttempt+'/answers/'+codeQuestion.id,{method:'PUT',body:{codeAnswer:'def add(a,b): return a+b'}});
    await student.request(base,studentPath+'/attempts/'+codeAttempt+'/submit',{method:'POST'});
    await admin.request(base,adminPath+'/'+codeAssessment+'/close',{method:'POST'});
    assert.equal((await admin.request(base,adminPath+'/'+codeAssessment+'/release-results',{method:'POST'})).status,400,'ungraded coding cannot be released');
    assert.equal((await admin.request(base,adminPath+'/attempts/'+codeAttempt+'/questions/'+codeQuestion.id+'/grade',{method:'PATCH',body:{points:4,feedback:'Good work.'}})).status,200);
    assert.equal((await admin.request(base,adminPath+'/'+codeAssessment+'/release-results',{method:'POST'})).status,200);
    assert.equal((await student.request(base,studentPath+'/attempts/'+codeAttempt)).data.attempt.score,4);
    assert.equal((await admin.request(base,adminPath+'/attempts/'+codeAttempt+'/questions/'+codeQuestion.id+'/grade',{method:'PATCH',body:{points:3,feedback:'Changed after release'}})).status,409,'published grades are immutable');
    assert.equal(db.pragma('integrity_check')[0].integrity_check,'ok');
  }finally {
    await new Promise(resolve=>server.close(resolve));
    db.close();
    fs.rmSync(root,{recursive:true,force:true});
  }
});
