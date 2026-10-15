import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { db, now, json, audit } from '../db.js';
import { requireUser, requirePasswordChanged } from '../auth.js';
import { hasPermission, PERMISSIONS } from '../permissions.js';

const router = Router();
router.use(requireUser,requirePasswordChanged);
const uuid = () => crypto.randomUUID();
const error = (res,message,status=400) => res.status(status).json({ error:message });
const manage = (req,res,next) => hasPermission(req.user,PERMISSIONS.MANAGE_ASSESSMENTS) ? next() : error(res,'Assessment management permission required.',403);
const grade = (req,res,next) => hasPermission(req.user,PERMISSIONS.GRADE_ASSESSMENTS) ? next() : error(res,'Assessment grading permission required.',403);
const release = (req,res,next) => hasPermission(req.user,PERMISSIONS.RELEASE_ASSESSMENTS) ? next() : error(res,'Assessment release permission required.',403);
const adminRead = (req,res,next) => ['MANAGE_ASSESSMENTS','GRADE_ASSESSMENTS','RELEASE_ASSESSMENTS'].some(key => hasPermission(req.user,PERMISSIONS[key])) ? next() : error(res,'Assessment administration permission required.',403);
const studentOnly = (req,res,next) => req.user.role === 'student' ? next() : error(res,'Student access required.',403);
const adminOnly = (req,res,next) => req.user.role === 'admin' ? next() : error(res,'Administrator access required.',403);

const text = (max=2000) => z.string().trim().min(1).max(max);
const optionalText = (max=2000) => z.string().trim().max(max).default('');
const bankSchema = z.object({
  title:text(120),description:optionalText(1200),academicYear:z.number().int().min(1).max(6).nullable().default(null),
  batch:optionalText(60)
});
const questionSchema = z.object({
  kind:z.enum(['mcq','coding']).default('mcq'),prompt:text(10000),
  options:z.array(text(1000)).length(4).optional(),correctOption:z.number().int().min(0).max(3).optional(),
  points:z.number().positive().max(10000),language:optionalText(60),
  externalUrl:optionalText(500)
}).superRefine((value,ctx) => {
  if (value.kind === 'mcq' && (!value.options || value.correctOption === undefined)) {
    ctx.addIssue({ code:'custom',message:'MCQ questions need four options and a correct answer.' });
  }
  if (value.kind==='mcq' && value.options && new Set(value.options.map(option=>option.toLowerCase())).size!==4) {
    ctx.addIssue({ code:'custom',message:'MCQ options must be distinct.' });
  }
  if (value.externalUrl && !/^https:\/\/(www\.)?hackerrank\.com\//i.test(value.externalUrl)) {
    ctx.addIssue({ code:'custom',message:'Only HTTPS HackerRank links are supported.' });
  }
});
const dateField = z.string().nullable().default(null).refine(value => value === null || (Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value)),'Use a timezone-aware ISO date.');
const assessmentSchema = z.object({
  title:text(160),description:optionalText(2500),instructions:optionalText(5000),
  kind:z.enum(['mcq','coding']),bankId:z.string().uuid(),
  questionCount:z.number().int().min(1).max(200),
  questionIds:z.array(z.string().uuid()).max(200).default([]),
  allowBackward:z.boolean().default(true),
  pointsMode:z.enum(['equal','custom']),totalPoints:z.number().positive().max(100000),
  durationMinutes:z.number().int().min(1).max(360),startAt:dateField,endAt:dateField,
  attemptLimit:z.number().int().min(1).max(10).default(1),
  eligibilityYear:z.number().int().min(1).max(6).nullable().default(null)
}).superRefine((value,ctx) => {
  if (value.startAt && value.endAt && Date.parse(value.endAt) <= Date.parse(value.startAt)) {
    ctx.addIssue({ code:'custom',message:'End date must come after start date.' });
  }
  if (new Set(value.questionIds).size !== value.questionIds.length) {
    ctx.addIssue({ code:'custom',message:'The question selection contains duplicates.' });
  }
  if (value.questionIds.length && value.questionIds.length !== value.questionCount) {
    ctx.addIssue({ code:'custom',message:'Selected question count must match the assessment question count.' });
  }
});
function parse(schema,body,res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    error(res,result.error.issues.map(issue => issue.message).join(' '));
    return null;
  }
  return result.data;
}
function questionRow(row,includeAnswers=true) {
  const result = { id:row.id,kind:row.kind,prompt:row.prompt,options:json(row.options_json,[]),
    points:row.points,language:row.language,externalUrl:row.external_url };
  if (includeAnswers) result.correctOption = row.correct_option;
  return result;
}
function getBank(id) { return db.prepare('SELECT * FROM assessment_banks WHERE id=?').get(id); }
function getAssessment(id) { return db.prepare('SELECT * FROM assessments WHERE id=?').get(id); }
function selectedQuestions(input) {
  const bank = getBank(input.bankId);
  if (!bank) throw new Error('Question bank not found.');
  const all = db.prepare('SELECT * FROM assessment_bank_questions WHERE bank_id=? AND kind=? ORDER BY created_at,id')
    .all(input.bankId,input.kind);
  const selected = input.questionIds.length
    ? input.questionIds.map(id => all.find(question => question.id === id))
    : all.slice(0,input.questionCount);
  if (selected.length !== input.questionCount || selected.some(question => !question)) throw new Error('Choose enough valid questions from the selected bank.');
  if (input.pointsMode === 'custom') {
    const sum = selected.reduce((acc,question) => acc + question.points,0);
    if (Math.abs(sum - input.totalPoints) > 0.001) throw new Error('Custom question points must add up to Total Points.');
  } else {
    const each = input.totalPoints / input.questionCount;
    if (Math.round(each*100) / 100 !== each && Math.abs(Math.round(each*100)/100-each) > 0.0000001) {
      throw new Error('Equal points must be divisible across questions to two decimal places.');
    }
  }
  return selected;
}
function assessmentDetails(row) {
  return { id:row.id,title:row.title,description:row.description,instructions:row.instructions,kind:row.kind,
    bankId:row.bank_id,questionCount:row.question_count,questionIds:json(row.selected_question_ids,[]),
    allowBackward:Boolean(row.allow_backward),pointsMode:row.points_mode,totalPoints:row.total_points,
    durationMinutes:row.duration_minutes,startAt:row.start_at,endAt:row.end_at,
    attemptLimit:row.attempt_limit,eligibilityYear:row.eligibility_year,status:row.status,
    resultsPublishedAt:row.results_published_at,createdAt:row.created_at,updatedAt:row.updated_at };
}
function withError(handler) {
  return (req,res,next) => {
    try {
      const task = handler(req,res);
      if (task?.catch) task.catch(next);
    } catch (cause) {
      if (cause.message === 'Question bank not found.' || cause.message.startsWith('Choose enough valid questions') ||
        cause.message.startsWith('Custom question') || cause.message.startsWith('Equal points')) return error(res,cause.message);
      next(cause);
    }
  };
}
const upload = multer({
  storage:multer.memoryStorage(),limits:{ fileSize:1024*1024,files:1 },
  fileFilter:(req,file,callback) => callback(null,/\.xlsx$/i.test(file.originalname))
});

router.get('/admin/banks',adminOnly,adminRead,(req,res) => {
  const items = db.prepare('SELECT b.*, (SELECT count(*) FROM assessment_bank_questions q WHERE q.bank_id=b.id) question_count FROM assessment_banks b ORDER BY b.updated_at DESC').all();
  res.json({ items:items.map(item => ({ id:item.id,title:item.title,academicYear:item.academic_year,batch:item.batch,description:item.description,questionCount:item.question_count })) });
});
router.post('/admin/banks',adminOnly,manage,withError((req,res) => {
  const input = parse(bankSchema,req.body,res);
  if (!input) return;
  const id=uuid(),time=now();
  db.prepare('INSERT INTO assessment_banks (id,title,academic_year,batch,description,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id,input.title,input.academicYear,input.batch,input.description,req.user.id,time,time);
  audit(req.user.id,'assessment.bank_created','assessment-bank',id);
  res.status(201).json({ id });
}));
router.put('/admin/banks/:bankId',adminOnly,manage,withError((req,res) => {
  if (!getBank(req.params.bankId)) return error(res,'Question bank not found.',404);
  const input=parse(bankSchema,req.body,res);
  if (!input) return;
  db.prepare('UPDATE assessment_banks SET title=?,academic_year=?,batch=?,description=?,updated_at=? WHERE id=?')
    .run(input.title,input.academicYear,input.batch,input.description,now(),req.params.bankId);
  res.json({ ok:true });
}));
router.get('/admin/banks/:bankId/questions',adminOnly,adminRead,(req,res) => {
  if (!getBank(req.params.bankId)) return error(res,'Question bank not found.',404);
  const items=db.prepare('SELECT * FROM assessment_bank_questions WHERE bank_id=? ORDER BY created_at,id').all(req.params.bankId);
  res.json({ items:items.map(row => questionRow(row)) });
});
function addQuestion(bankId,input) {
  const id=uuid(),time=now();
  db.prepare('INSERT INTO assessment_bank_questions (id,bank_id,kind,prompt,options_json,correct_option,points,language,external_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,bankId,input.kind,input.prompt,JSON.stringify(input.options || []),input.kind==='mcq' ? input.correctOption : null,
      input.points,input.language,input.externalUrl,time,time);
  return id;
}
router.post('/admin/banks/:bankId/questions',adminOnly,manage,withError((req,res) => {
  if (!getBank(req.params.bankId)) return error(res,'Question bank not found.',404);
  const input=parse(questionSchema,req.body,res);
  if (!input) return;
  const id=addQuestion(req.params.bankId,input);
  audit(req.user.id,'assessment.question_created','assessment-question',id);
  res.status(201).json({ id });
}));
router.put('/admin/banks/:bankId/questions/:questionId',adminOnly,manage,withError((req,res) => {
  const input=parse(questionSchema,req.body,res);
  if (!input) return;
  const result=db.prepare('UPDATE assessment_bank_questions SET kind=?,prompt=?,options_json=?,correct_option=?,points=?,language=?,external_url=?,updated_at=? WHERE id=? AND bank_id=?')
    .run(input.kind,input.prompt,JSON.stringify(input.options || []),input.kind==='mcq'?input.correctOption:null,
      input.points,input.language,input.externalUrl,now(),req.params.questionId,req.params.bankId);
  if (!result.changes) return error(res,'Question not found.',404);
  res.json({ ok:true });
}));
router.delete('/admin/banks/:bankId/questions/:questionId',adminOnly,manage,(req,res) => {
  const result=db.prepare('DELETE FROM assessment_bank_questions WHERE id=? AND bank_id=?').run(req.params.questionId,req.params.bankId);
  if (!result.changes) return error(res,'Question not found.',404);
  res.status(204).end();
});

function excelCell(row,index) {
  const raw=row.getCell(index).value;
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') throw new Error('Formulas, hyperlinks and embedded cell objects are not accepted.');
  return String(raw).trim();
}
async function parseWorkbook(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.worksheets[0];
  if (!sheet) throw new Error('The workbook has no worksheet.');
  if (sheet.rowCount > 501) throw new Error('Import up to 500 questions at a time.');
  const headings={};
  sheet.getRow(1).eachCell((cell,index) => {
    const name=String(cell.value || '').trim().toLowerCase().replace(/[\s_-]+/g,'');
    headings[name]=index;
  });
  const required=['question','optiona','optionb','optionc','optiond','correctanswer','points'];
  if (required.some(name => !headings[name])) throw new Error('Excel headings must include Question, Option A-D, Correct Answer and Points.');
  const items=[],issues=[];
  for (let number=2;number<=sheet.rowCount;number++) {
    const row=sheet.getRow(number);
    let raw;
    try {
      raw=Object.fromEntries(Object.entries(headings).map(([name,index]) => [name,excelCell(row,index)]));
    } catch (cause) {
      issues.push({ row:number,error:cause.message }); continue;
    }
    if (!Object.values(raw).some(Boolean)) continue;
    const kind=(raw.type || 'mcq').toLowerCase() === 'coding' ? 'coding' : 'mcq';
    const letter=(raw.correctanswer || '').toUpperCase();
    const correctOption=kind==='coding' ? undefined : letter.length===1 ? 'ABCD'.indexOf(letter) : Number(letter)-1;
    const candidate={ kind,prompt:raw.question || '',points:Number(raw.points),
      options:[raw.optiona || '',raw.optionb || '',raw.optionc || '',raw.optiond || ''],
      correctOption,language:raw.language || '',externalUrl:raw.externalurl || '' };
    const result=questionSchema.safeParse(candidate);
    if (result.success) items.push({ ...result.data,sourceRow:number });
    else issues.push({ row:number,error:result.error.issues.map(issue => issue.message).join(' ') });
  }
  if (!items.length && !issues.length) issues.push({ row:2,error:'No questions found.' });
  return { items,issues };
}
async function acceptExcel(req,res,persist) {
  if (!getBank(req.params.bankId)) return error(res,'Question bank not found.',404);
  if (!req.file) return error(res,'Choose an .xlsx file, maximum 1 MB.');
  try {
    const { items,issues }=await parseWorkbook(req.file.buffer);
    const known=new Set(db.prepare('SELECT kind,prompt FROM assessment_bank_questions WHERE bank_id=?').all(req.params.bankId)
      .map(q=>q.kind+'|'+q.prompt.trim().toLowerCase()));
    for (const question of items) {
      const key=question.kind+'|'+question.prompt.trim().toLowerCase();
      if (known.has(key)) issues.push({ row:question.sourceRow,error:'Duplicate question in this workbook or bank.' });
      known.add(key);
    }
    if (issues.length) return res.status(400).json({ error:'Fix Excel validation issues before importing.',issues,validCount:items.length });
    if (persist) {
      db.transaction(() => {
        for (const question of items) addQuestion(req.params.bankId,question);
        db.prepare('UPDATE assessment_banks SET updated_at=? WHERE id=?').run(now(),req.params.bankId);
        audit(req.user.id,'assessment.questions_imported','assessment-bank',req.params.bankId,{ count:items.length });
      })();
      return res.status(201).json({ count:items.length });
    }
    return res.json({ count:items.length,items });
  } catch (cause) {
    return error(res,'Invalid Excel workbook: '+cause.message);
  }
}
router.post('/admin/banks/:bankId/import-preview',adminOnly,manage,upload.single('file'),(req,res) => acceptExcel(req,res,false));
router.post('/admin/banks/:bankId/import',adminOnly,manage,upload.single('file'),(req,res) => acceptExcel(req,res,true));
router.get('/admin/excel-template',adminOnly,adminRead,withError(async (req,res) => {
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('Questions');
  sheet.addRow(['Question','Option A','Option B','Option C','Option D','Correct Answer','Points','Type','Language','External URL']);
  sheet.addRow(['What does AI stand for?','Artificial Intelligence','Automatic Internet','Applied Input','None','A',2,'mcq','','']);
  sheet.addRow(['Write a function that returns the sum of two numbers.','','','','','',5,'coding','Python','']);
  sheet.getRow(1).font={ bold:true };
  const buffer=await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition','attachment; filename="ai-club-assessment-template.xlsx"');
  res.setHeader('Cache-Control','private, no-store');
  res.send(Buffer.from(buffer));
}));

router.get('/admin',adminOnly,adminRead,(req,res) => {
  const items=db.prepare('SELECT a.*,b.title bank_title,b.academic_year bank_year,b.batch bank_batch,(SELECT count(*) FROM assessment_attempts t WHERE t.assessment_id=a.id) attempt_count FROM assessments a LEFT JOIN assessment_banks b ON b.id=a.bank_id ORDER BY a.created_at DESC').all();
  res.json({ items:items.map(row => ({ ...assessmentDetails(row),bankTitle:row.bank_title,bankYear:row.bank_year,bankBatch:row.bank_batch,attemptCount:row.attempt_count })) });
});
router.get('/admin/:id',adminOnly,adminRead,(req,res) => {
  const row=getAssessment(req.params.id);
  if (!row) return error(res,'Assessment not found.',404);
  const questions=db.prepare('SELECT * FROM assessment_questions WHERE assessment_id=? ORDER BY position').all(row.id).map(q=>questionRow(q));
  res.json({ assessment:assessmentDetails(row),questions });
});
function saveAssessment(req,res,isUpdate) {
  const input=parse(assessmentSchema,req.body,res);
  if (!input) return;
  const old=isUpdate ? getAssessment(req.params.id) : null;
  if (isUpdate && !old) return error(res,'Assessment not found.',404);
  if (old && old.status !== 'draft') return error(res,'Only drafts may be edited.',409);
  selectedQuestions(input);
  const id=old?.id || uuid(),time=now();
  const values=[input.title,input.description,input.instructions,input.kind,input.bankId,input.questionCount,
    Number(input.allowBackward),input.pointsMode,input.totalPoints,input.durationMinutes,input.startAt,input.endAt,
    input.attemptLimit,input.eligibilityYear,JSON.stringify(input.questionIds),time];
  if (old) {
    db.prepare('UPDATE assessments SET title=?,description=?,instructions=?,kind=?,bank_id=?,question_count=?,allow_backward=?,points_mode=?,total_points=?,duration_minutes=?,start_at=?,end_at=?,attempt_limit=?,eligibility_year=?,selected_question_ids=?,updated_at=? WHERE id=?')
      .run(...values,id);
  } else {
    db.prepare('INSERT INTO assessments (id,title,description,instructions,kind,bank_id,question_count,allow_backward,points_mode,total_points,duration_minutes,start_at,end_at,attempt_limit,eligibility_year,selected_question_ids,updated_at,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,...values,time,req.user.id);
  }
  audit(req.user.id,old?'assessment.updated':'assessment.created','assessment',id);
  return res.status(old?200:201).json({ id });
}
router.post('/admin',adminOnly,manage,withError((req,res) => saveAssessment(req,res,false)));
router.put('/admin/:id',adminOnly,manage,withError((req,res) => saveAssessment(req,res,true)));
router.post('/admin/:id/publish',adminOnly,manage,withError((req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment) return error(res,'Assessment not found.',404);
  if (assessment.status !== 'draft') return error(res,'Only draft assessments may be published.',409);
  const input={ bankId:assessment.bank_id,kind:assessment.kind,questionCount:assessment.question_count,
    questionIds:json(assessment.selected_question_ids,[]),pointsMode:assessment.points_mode,totalPoints:assessment.total_points };
  const selected=selectedQuestions(input);
  db.transaction(() => {
    selected.forEach((question,index) => {
      const points=assessment.points_mode==='equal' ? assessment.total_points/assessment.question_count : question.points;
      db.prepare('INSERT INTO assessment_questions (id,assessment_id,source_question_id,position,kind,prompt,options_json,correct_option,points,language,external_url) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(uuid(),assessment.id,question.id,index,question.kind,question.prompt,question.options_json,
          question.correct_option,points,question.language,question.external_url);
    });
    db.prepare("UPDATE assessments SET status='published',updated_at=? WHERE id=?").run(now(),assessment.id);
    audit(req.user.id,'assessment.published','assessment',assessment.id);
  })();
  res.json({ ok:true });
}));
router.post('/admin/:id/close',adminOnly,manage,(req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment) return error(res,'Assessment not found.',404);
  if (assessment.status!=='published') return error(res,'Only published assessments can be closed.',409);
  db.transaction(() => {
    for (const attempt of db.prepare("SELECT * FROM assessment_attempts WHERE assessment_id=? AND status='in_progress'").all(assessment.id)) finishAttempt(attempt);
    db.prepare("UPDATE assessments SET status='closed',updated_at=? WHERE id=?").run(now(),assessment.id);
    audit(req.user.id,'assessment.closed','assessment',assessment.id);
  })();
  res.json({ ok:true });
});
router.post('/admin/:id/archive',adminOnly,manage,(req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment || !['closed','draft'].includes(assessment.status)) return error(res,'Only draft or closed assessments can be archived.',409);
  db.prepare("UPDATE assessments SET status='archived',updated_at=? WHERE id=?").run(now(),assessment.id);
  res.json({ ok:true });
});
router.get('/admin/:id/attempts',adminOnly,adminRead,(req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment) return error(res,'Assessment not found.',404);
  const items=db.prepare('SELECT t.*,u.member_id,u.name FROM assessment_attempts t JOIN users u ON u.id=t.student_id WHERE t.assessment_id=? ORDER BY t.started_at DESC').all(assessment.id);
  res.json({ assessment:assessmentDetails(assessment),items:items.map(t => ({
    id:t.id,studentId:t.student_id,memberId:t.member_id,studentName:t.name,attemptNumber:t.attempt_number,
    startedAt:t.started_at,submittedAt:t.submitted_at,status:t.status,score:t.score,gradedAt:t.graded_at
  })) });
});
router.get('/admin/attempts/:attemptId',adminOnly,adminRead,(req,res) => {
  const attempt=db.prepare('SELECT * FROM assessment_attempts WHERE id=?').get(req.params.attemptId);
  if (!attempt) return error(res,'Attempt not found.',404);
  const questions=db.prepare('SELECT q.*,a.selected_option,a.code_answer,a.awarded_points,a.feedback FROM assessment_questions q LEFT JOIN assessment_answers a ON a.question_id=q.id AND a.attempt_id=? WHERE q.assessment_id=? ORDER BY q.position')
    .all(attempt.id,attempt.assessment_id);
  res.json({ attempt,questions:questions.map(q => ({
    ...questionRow(q),selectedOption:q.selected_option,codeAnswer:q.code_answer || '',
    awardedPoints:q.awarded_points,feedback:q.feedback || ''
  })) });
});
router.patch('/admin/attempts/:attemptId/questions/:questionId/grade',adminOnly,grade,(req,res) => {
  const attempt=db.prepare('SELECT * FROM assessment_attempts WHERE id=?').get(req.params.attemptId);
  if (!attempt || attempt.status !== 'submitted') return error(res,'Submitted attempt not found.',404);
  if (getAssessment(attempt.assessment_id)?.results_published_at) return error(res,'Grades cannot change after results are published.',409);
  const q=db.prepare("SELECT * FROM assessment_questions WHERE id=? AND assessment_id=? AND kind='coding'")
    .get(req.params.questionId,attempt.assessment_id);
  if (!q) return error(res,'Coding question not found.',404);
  const input=parse(z.object({ points:z.number().min(0).max(q.points),feedback:optionalText(2000) }),req.body,res);
  if (!input) return;
  db.transaction(() => {
    db.prepare('INSERT INTO assessment_answers (attempt_id,question_id,awarded_points,feedback,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(attempt_id,question_id) DO UPDATE SET awarded_points=excluded.awarded_points,feedback=excluded.feedback,updated_at=excluded.updated_at')
      .run(attempt.id,q.id,input.points,input.feedback,now());
    const pending=db.prepare("SELECT count(*) count FROM assessment_questions q LEFT JOIN assessment_answers a ON a.question_id=q.id AND a.attempt_id=? WHERE q.assessment_id=? AND q.kind='coding' AND a.awarded_points IS NULL")
      .get(attempt.id,attempt.assessment_id).count;
    const score=db.prepare('SELECT coalesce(sum(awarded_points),0) score FROM assessment_answers WHERE attempt_id=?').get(attempt.id).score;
    db.prepare('UPDATE assessment_attempts SET score=?,graded_at=? WHERE id=?')
      .run(pending ? null : Math.round(score*100)/100,pending ? null : now(),attempt.id);
    audit(req.user.id,'assessment.attempt_graded','assessment-attempt',attempt.id,{ questionId:q.id });
  })();
  res.json({ ok:true });
});
router.post('/admin/:id/release-results',adminOnly,release,(req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment || assessment.status !== 'closed') return error(res,'Close the assessment before releasing results.',409);
  const pending=db.prepare("SELECT count(*) count FROM assessment_attempts WHERE assessment_id=? AND status='submitted' AND graded_at IS NULL")
    .get(assessment.id).count;
  if (pending) return error(res,'Grade all submitted attempts before publishing results.');
  db.prepare('UPDATE assessments SET results_published_at=?,updated_at=? WHERE id=?').run(now(),now(),assessment.id);
  audit(req.user.id,'assessment.results_published','assessment',assessment.id);
  res.json({ ok:true });
});

function studentEligible(assessment,userId) {
  if (!assessment.eligibility_year) return true;
  const profile=db.prepare('SELECT academic_year FROM student_profiles WHERE user_id=?').get(userId);
  return profile?.academic_year === assessment.eligibility_year;
}
function clockAvailability(assessment) {
  const time=Date.now();
  if (assessment.status!=='published') return 'closed';
  if (assessment.start_at && Date.parse(assessment.start_at)>time) return 'upcoming';
  if (assessment.end_at && Date.parse(assessment.end_at)<=time) return 'closed';
  return 'active';
}
function finishAttempt(attempt) {
  if (attempt.status!=='in_progress') return attempt;
  const questions=db.prepare('SELECT * FROM assessment_questions WHERE assessment_id=?').all(attempt.assessment_id);
  const answers=db.prepare('SELECT * FROM assessment_answers WHERE attempt_id=?').all(attempt.id);
  const answerByQuestion=new Map(answers.map(answer => [answer.question_id,answer]));
  let score=0,hasCoding=false;
  for (const q of questions) {
    if (q.kind==='coding') { hasCoding=true;continue; }
    const answer=answerByQuestion.get(q.id);
    const awarded=answer?.selected_option === q.correct_option ? q.points : 0;
    score+=awarded;
    db.prepare('INSERT INTO assessment_answers (attempt_id,question_id,selected_option,awarded_points,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(attempt_id,question_id) DO UPDATE SET awarded_points=excluded.awarded_points,updated_at=excluded.updated_at')
      .run(attempt.id,q.id,answer?.selected_option ?? null,awarded,now());
  }
  db.prepare("UPDATE assessment_attempts SET status='submitted',submitted_at=?,score=?,graded_at=? WHERE id=?")
    .run(now(),hasCoding ? null : Math.round(score*100)/100,hasCoding ? null : now(),attempt.id);
  return db.prepare('SELECT * FROM assessment_attempts WHERE id=?').get(attempt.id);
}
function maybeExpire(attempt) {
  if (attempt.status==='in_progress' && Date.parse(attempt.expires_at)<=Date.now()) return db.transaction(() => finishAttempt(attempt))();
  const assessment=getAssessment(attempt.assessment_id);
  if (attempt.status==='in_progress' && (assessment.status!=='published' || (assessment.end_at && Date.parse(assessment.end_at)<=Date.now()))) {
    return db.transaction(() => finishAttempt(attempt))();
  }
  return attempt;
}
function attemptView(attempt,assessment) {
  const submitted=attempt.status==='submitted';
  const published=Boolean(assessment.results_published_at);
  return { id:attempt.id,assessmentId:attempt.assessment_id,attemptNumber:attempt.attempt_number,
    status:attempt.status,startedAt:attempt.started_at,expiresAt:attempt.expires_at,
    submittedAt:attempt.submitted_at,furthestPosition:attempt.furthest_position,
    score:submitted && published ? attempt.score : null,
    graded:submitted && published && Boolean(attempt.graded_at),resultsAvailable:submitted && published };
}
router.get('/student',studentOnly,(req,res) => {
  const rows=db.prepare("SELECT * FROM assessments WHERE status IN ('published','closed') ORDER BY created_at DESC").all();
  const items=rows.filter(a => studentEligible(a,req.user.id)).map(a => {
    const attempts=db.prepare('SELECT * FROM assessment_attempts WHERE assessment_id=? AND student_id=? ORDER BY attempt_number DESC')
      .all(a.id,req.user.id).map(maybeExpire);
    const latest=attempts[0] || null;
    return { ...assessmentDetails(a),availability:clockAvailability(a),
      attemptsUsed:attempts.length,latestAttempt:latest ? attemptView(latest,a) : null };
  });
  res.json({ items });
});
router.post('/student/:id/start',studentOnly,(req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment || !studentEligible(assessment,req.user.id)) return error(res,'Assessment not available.',404);
  if (clockAvailability(assessment)!=='active') return error(res,'This assessment is not currently open.',409);
  const attempt=db.transaction(() => {
    const existing=db.prepare('SELECT * FROM assessment_attempts WHERE assessment_id=? AND student_id=? ORDER BY attempt_number DESC')
      .all(assessment.id,req.user.id);
    const active=existing.find(item => maybeExpire(item).status==='in_progress');
    if (active) return active;
    if (existing.length>=assessment.attempt_limit) return null;
    const start=Date.now();
    const expiry=Math.min(start + assessment.duration_minutes*60000,assessment.end_at ? Date.parse(assessment.end_at) : Infinity);
    const newAttempt={ id:uuid(),assessment_id:assessment.id,attempt_number:existing.length+1 };
    db.prepare('INSERT INTO assessment_attempts (id,assessment_id,student_id,attempt_number,started_at,expires_at) VALUES (?,?,?,?,?,?)')
      .run(newAttempt.id,assessment.id,req.user.id,newAttempt.attempt_number,new Date(start).toISOString(),new Date(expiry).toISOString());
    audit(req.user.id,'assessment.attempt_started','assessment-attempt',newAttempt.id);
    return db.prepare('SELECT * FROM assessment_attempts WHERE id=?').get(newAttempt.id);
  })();
  if (!attempt) return error(res,'You have used all allowed attempts.',409);
  res.status(201).json({ attempt:attemptView(attempt,assessment) });
});
function ownedAttempt(req,res) {
  const attempt=db.prepare('SELECT * FROM assessment_attempts WHERE id=? AND student_id=?').get(req.params.attemptId,req.user.id);
  if (!attempt) { error(res,'Attempt not found.',404);return null; }
  const settled=maybeExpire(attempt);
  return { attempt:settled,assessment:getAssessment(settled.assessment_id) };
}
router.get('/student/attempts/:attemptId',studentOnly,(req,res) => {
  const owned=ownedAttempt(req,res);
  if (!owned) return;
  const { attempt,assessment }=owned;
  const questions=db.prepare('SELECT * FROM assessment_questions WHERE assessment_id=? ORDER BY position').all(assessment.id);
  const answers=db.prepare('SELECT * FROM assessment_answers WHERE attempt_id=?').all(attempt.id);
  const visible=questions.map(q => {
    const accessible=assessment.allow_backward || (attempt.status==='in_progress' && q.position===attempt.furthest_position);
    if (!accessible) return { id:q.id,position:q.position,points:q.points,locked:true };
    return { ...questionRow(q,false),position:q.position,locked:false };
  });
  const answerMap=answers.filter(answer => assessment.allow_backward || (attempt.status==='in_progress' &&
    questions.find(q => q.id===answer.question_id)?.position===attempt.furthest_position))
    .map(answer => ({ questionId:answer.question_id,selectedOption:answer.selected_option,codeAnswer:answer.code_answer }));
  const answeredPositions=questions.filter(q=>{
    const answer=answers.find(a=>a.question_id===q.id);
    return answer && (answer.selected_option!==null || Boolean(answer.code_answer.trim()));
  }).map(q=>q.position);
  res.json({ answeredPositions,assessment:{ id:assessment.id,title:assessment.title,description:assessment.description,
    instructions:assessment.instructions,kind:assessment.kind,totalPoints:assessment.total_points,
    allowBackward:Boolean(assessment.allow_backward),questionCount:assessment.question_count,
    durationMinutes:assessment.duration_minutes,resultsPublishedAt:assessment.results_published_at },
    attempt:attemptView(attempt,assessment),questions:visible,answers:answerMap });
});
router.put('/student/attempts/:attemptId/answers/:questionId',studentOnly,(req,res) => {
  const owned=ownedAttempt(req,res);
  if (!owned) return;
  const { attempt,assessment }=owned;
  if (attempt.status!=='in_progress') return error(res,'This attempt is already submitted.',409);
  const question=db.prepare('SELECT * FROM assessment_questions WHERE id=? AND assessment_id=?').get(req.params.questionId,assessment.id);
  if (!question) return error(res,'Question not found.',404);
  if (!assessment.allow_backward && question.position!==attempt.furthest_position) return error(res,'Backward navigation is disabled.',403);
  let selectedOption=null,codeAnswer='';
  if (question.kind==='mcq') {
    const data=parse(z.object({ selectedOption:z.number().int().min(0).max(3).nullable() }),req.body,res);
    if (!data) return;
    selectedOption=data.selectedOption;
  } else {
    const data=parse(z.object({ codeAnswer:z.string().max(50000) }),req.body,res);
    if (!data) return;
    codeAnswer=data.codeAnswer;
  }
  db.prepare('INSERT INTO assessment_answers (attempt_id,question_id,selected_option,code_answer,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option=excluded.selected_option,code_answer=excluded.code_answer,updated_at=excluded.updated_at')
    .run(attempt.id,question.id,selectedOption,codeAnswer,now());
  res.json({ saved:true });
});
router.post('/student/attempts/:attemptId/advance',studentOnly,(req,res) => {
  const owned=ownedAttempt(req,res);
  if (!owned) return;
  const { attempt,assessment }=owned;
  if (attempt.status!=='in_progress') return error(res,'This attempt is already submitted.',409);
  if (assessment.allow_backward) return res.json({ nextPosition:attempt.furthest_position });
  if (attempt.furthest_position>=assessment.question_count-1) return error(res,'Submit the assessment after the final question.',409);
  const nextPosition=attempt.furthest_position+1;
  db.prepare('UPDATE assessment_attempts SET furthest_position=? WHERE id=?').run(nextPosition,attempt.id);
  res.json({ nextPosition });
});
router.post('/student/attempts/:attemptId/submit',studentOnly,(req,res) => {
  const owned=ownedAttempt(req,res);
  if (!owned) return;
  const { attempt,assessment }=owned;
  const final=attempt.status==='submitted' ? attempt : db.transaction(() => finishAttempt(attempt))();
  audit(req.user.id,'assessment.attempt_submitted','assessment-attempt',final.id);
  res.json({ attempt:attemptView(final,assessment) });
});
router.get('/student/:id/history',studentOnly,(req,res) => {
  const assessment=getAssessment(req.params.id);
  if (!assessment || !studentEligible(assessment,req.user.id) || assessment.status==='draft') return error(res,'Assessment not found.',404);
  const attempts=db.prepare('SELECT * FROM assessment_attempts WHERE assessment_id=? AND student_id=? ORDER BY attempt_number DESC')
    .all(assessment.id,req.user.id).map(maybeExpire);
  res.json({ assessment:assessmentDetails(assessment),items:attempts.map(attempt => attemptView(attempt,assessment)) });
});
router.use((cause,req,res,next) => {
  if (cause instanceof multer.MulterError) return error(res,'Excel files must be 1 MB or smaller.');
  next(cause);
});
export default router;
