import { ArrowRight,BookOpen,CheckCircle2,ChevronLeft,ClipboardList,FileSpreadsheet,Plus,ShieldCheck,UploadCloud } from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { PageHead,StateMessage } from './StudentDashboardPage';
import { useAuth } from '../context/AuthContext';
import { hasPermission,PERMISSIONS } from '../../shared/permissions';
import './Assessments.css';

const blankBank={ title:'',description:'',academicYear:'',batch:'' };
const blankQuestion={ kind:'mcq',prompt:'',options:['','','',''],correctOption:0,points:1,language:'',externalUrl:'' };
const blankAssessment={ title:'',description:'',instructions:'',kind:'mcq',bankId:'',questionCount:1,
  questionIds:[],allowBackward:true,pointsMode:'equal',totalPoints:10,durationMinutes:30,
  startAt:'',endAt:'',attemptLimit:1,eligibilityYear:'' };
function dateValue(value) { if (!value) return ''; const time=new Date(value);return Number.isNaN(time.getTime())?'':new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16); }
function dateIso(value) { return value ? new Date(value).toISOString() : null; }
function selectBankYear(value) { return value ? Number(value) : null; }
function tag(value) { return <span className={'assessment-tag is-'+value}>{value.replaceAll('_',' ')}</span>; }
function displayStatus(item) {
  if (item.status!=='published') return item.status;
  if (item.startAt && Date.parse(item.startAt)>Date.now()) return 'scheduled';
  if (item.endAt && Date.parse(item.endAt)<=Date.now()) return 'ended';
  return 'active';
}
function Field({ title,children,wide=false,help }) {
  return <label className={'assessment-field'+(wide?' is-wide':'')}><span>{title}</span>{children}{help&&<small>{help}</small>}</label>;
}
function Button({ children,onClick,disabled,secondary=false,type='button' }) {
  return <button type={type} disabled={disabled} className={secondary?'portal-secondary-button':'dash-action'} onClick={onClick}>{children}</button>;
}
export default function AdminAssessmentsPage() {
  const { session }=useAuth();
  const canManage=hasPermission(session,PERMISSIONS.MANAGE_ASSESSMENTS);
  const canGrade=hasPermission(session,PERMISSIONS.GRADE_ASSESSMENTS);
  const canRelease=hasPermission(session,PERMISSIONS.RELEASE_ASSESSMENTS);
  const [tab,setTab]=useState('assessments');
  const [filters,setFilters]=useState({search:'',kind:'',status:'',year:'',batch:''});
  const [banks,setBanks]=useState([]),[assessments,setAssessments]=useState([]);
  const [bank,setBank]=useState(blankBank),[activeBank,setActiveBank]=useState('');
  const [questions,setQuestions]=useState([]),[question,setQuestion]=useState(blankQuestion),[editQuestion,setEditQuestion]=useState('');
  const [form,setForm]=useState(blankAssessment),[editAssessment,setEditAssessment]=useState('');
  const [expanded,setExpanded]=useState(''),[attempts,setAttempts]=useState([]),[review,setReview]=useState(null);
  const [preview,setPreview]=useState(null),[file,setFile]=useState(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [error,setError]=useState('');
  const update=(setter,key,value)=>setter(current=>({ ...current,[key]:value }));
  const activeBankData=useMemo(()=>banks.find(item=>item.id===activeBank),[banks,activeBank]);
  const filteredAssessments=useMemo(()=>assessments.filter(a=>
    (!filters.search||a.title.toLowerCase().includes(filters.search.toLowerCase())) &&
    (!filters.kind||a.kind===filters.kind) && (!filters.status||displayStatus(a)===filters.status) &&
    (!filters.year||String(a.bankYear)===filters.year) &&
    (!filters.batch||(a.bankBatch||'').toLowerCase().includes(filters.batch.toLowerCase()))
  ),[assessments,filters]);
  const matchingQuestions=useMemo(()=>questions.filter(q=>q.kind===form.kind),[questions,form.kind]);
  const chosenQuestions=useMemo(()=>form.questionIds.length ? form.questionIds.map(id=>matchingQuestions.find(q=>q.id===id)).filter(Boolean) : matchingQuestions.slice(0,Number(form.questionCount)),[form,matchingQuestions]);
  const totalFromQuestions=chosenQuestions.reduce((sum,q)=>sum+Number(q.points),0);
  const load=useCallback(async()=> {
    setLoading(true);
    try {
      const [b,a]=await Promise.all([api('/api/assessments/admin/banks'),api('/api/assessments/admin')]);
      setBanks(b.items);setAssessments(a.items);setError('');
    } catch(cause) { setError(cause.message); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    let active=true;
    if (!activeBank) { setQuestions([]);return; }
    api('/api/assessments/admin/banks/'+activeBank+'/questions').then(data=>{if(active)setQuestions(data.items);}).catch(cause=>{if(active)setError(cause.message);});
    return ()=>{active=false;};
  },[activeBank]);
  async function perform(action,success) {
    setBusy(true);setMessage('');setError('');
    try { await action();setMessage(success);await load(); }
    catch(cause){setError(cause.message+(cause.issues?.length?' '+cause.issues.slice(0,8).map(item=>'Row '+item.row+': '+item.error).join('; '):''));}
    finally{setBusy(false);}
  }
  async function saveBank(event) {
    event.preventDefault();
    await perform(async()=>{
      const result=await api('/api/assessments/admin/banks',{method:'POST',body:JSON.stringify({ ...bank,academicYear:selectBankYear(bank.academicYear) })});
      setBank(blankBank);setActiveBank(result.id);
    },'Question bank created.');
  }
  function resetQuestion() { setQuestion(blankQuestion);setEditQuestion(''); }
  async function saveQuestion(event) {
    event.preventDefault();
    await perform(async()=>{
      const path='/api/assessments/admin/banks/'+activeBank+'/questions'+(editQuestion?'/'+editQuestion:'');
      await api(path,{method:editQuestion?'PUT':'POST',body:JSON.stringify({ ...question,points:Number(question.points),correctOption:Number(question.correctOption) })});
      const data=await api('/api/assessments/admin/banks/'+activeBank+'/questions');setQuestions(data.items);resetQuestion();
    },editQuestion?'Question updated.':'Question added.');
  }
  async function importFile(persist=false) {
    if (!file || !activeBank) return;
    const data=new FormData();data.set('file',file);
    await perform(async()=>{
      const result=await api('/api/assessments/admin/banks/'+activeBank+'/'+(persist?'import':'import-preview'),{ method:'POST',body:data });
      if(persist) {
        setPreview(null);setFile(null);
        const response=await api('/api/assessments/admin/banks/'+activeBank+'/questions');
        setQuestions(response.items);
      } else setPreview(result);
    },persist?'Excel questions imported.':'Excel preview validated. No questions imported yet.');
  }
  async function downloadTemplate() {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/assessments/admin/excel-template',{credentials:'include'});
      if(!response.ok) throw new Error('Template download failed.');
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;link.download='ai-club-assessment-template.xlsx';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(cause){setError(cause.message);}finally{setBusy(false);}
  }
  async function showBank(id) {
    setActiveBank(id);
    setForm(current=>({ ...current,bankId:id,questionIds:[] }));
    setPreview(null);setFile(null);resetQuestion();
    setTab('banks');
  }
  function editDraft(item) {
    setForm({ title:item.title,description:item.description,instructions:item.instructions,kind:item.kind,bankId:item.bankId,
      questionCount:item.questionCount,questionIds:item.questionIds,allowBackward:item.allowBackward,pointsMode:item.pointsMode,
      totalPoints:item.totalPoints,durationMinutes:item.durationMinutes,startAt:dateValue(item.startAt),endAt:dateValue(item.endAt),
      attemptLimit:item.attemptLimit,eligibilityYear:item.eligibilityYear||'' });
    setEditAssessment(item.id);setActiveBank(item.bankId);setTab('create');setMessage('');
  }
  function startNew() {setForm(blankAssessment);setEditAssessment('');setActiveBank('');setTab('create');setMessage('');}
  async function saveAssessment(event) {
    event.preventDefault();
    await perform(async()=>{
      const body={...form,questionCount:Number(form.questionCount),totalPoints:Number(form.totalPoints),
        durationMinutes:Number(form.durationMinutes),attemptLimit:Number(form.attemptLimit),
        startAt:dateIso(form.startAt),endAt:dateIso(form.endAt),eligibilityYear:selectBankYear(form.eligibilityYear)};
      const result=await api('/api/assessments/admin'+(editAssessment?'/'+editAssessment:''),{method:editAssessment?'PUT':'POST',body:JSON.stringify(body)});
      setEditAssessment(result.id);setTab('assessments');
    },'Assessment draft saved. Publish it when ready.');
  }
  async function operate(id,action) {
    const prompt={publish:'Publish this assessment? Its questions and marks will be locked.',
      close:'Close this assessment and submit all remaining attempts?',
      'release-results':'Make results visible to students?',
      archive:'Archive this assessment?'}[action];
    if (!window.confirm(prompt)) return;
    await perform(()=>api('/api/assessments/admin/'+id+'/'+action,{method:'POST'}),action==='release-results'?'Results are now published.':'Assessment updated.');
    if(expanded===id) await openAttempts(id);
  }
  async function openAttempts(id) {
    setExpanded(current=>current===id?'':id);
    try {const data=await api('/api/assessments/admin/'+id+'/attempts');setAttempts(data.items);}catch(cause){setError(cause.message);}
  }
  async function openReview(id) {
    try{const data=await api('/api/assessments/admin/attempts/'+id);setReview(data);setMessage('');}
    catch(cause){setError(cause.message);}
  }
  async function gradeQuestion(q,points,feedback) {
    await perform(async()=>{
      await api('/api/assessments/admin/attempts/'+review.attempt.id+'/questions/'+q.id+'/grade',
        {method:'PATCH',body:JSON.stringify({points:Number(points),feedback})});
      const result=await api('/api/assessments/admin/attempts/'+review.attempt.id);
      setReview(result);
      const overview=await api('/api/assessments/admin/'+review.attempt.assessment_id+'/attempts');
      setAttempts(overview.items);
    },'Grade saved.');
  }
  return <DashboardShell section="Assessments">
    <PageHead eyebrow="ASSESSMENT MANAGEMENT" title="Assessments." text="Create question banks, publish tests, and control when results are released." action={canManage&&<Button onClick={startNew}><Plus size={16}/>New assessment</Button>}/>
    <div className="assessment-tabs" role="tablist" aria-label="Assessment sections">
      {[['assessments','All assessments'],['banks','Question banks'],['create',editAssessment?'Edit draft':'Create assessment']].filter(([,],index)=>canManage||index===0).map(([key,label])=>
        <button type="button" role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)}>{label}</button>)}
    </div>
    {message&&<div className="portal-banner is-success" role="status">{message}</div>}
    {error&&<StateMessage tone="error">{error}</StateMessage>}
    {loading&&<StateMessage>Loading assessment workspace...</StateMessage>}
    {!loading&&tab==='assessments'&&<div className="assessment-stack">
      <div className="dash-card assessment-filters"><label className="assessment-field"><span>Search</span><input value={filters.search} placeholder="Assessment title" onChange={e=>update(setFilters,'search',e.target.value)}/></label>
        <label className="assessment-field"><span>Type</span><select value={filters.kind} onChange={e=>update(setFilters,'kind',e.target.value)}><option value="">All types</option><option value="mcq">MCQ</option><option value="coding">Coding</option></select></label>
        <label className="assessment-field"><span>Status</span><select value={filters.status} onChange={e=>update(setFilters,'status',e.target.value)}><option value="">All statuses</option>{['draft','scheduled','active','ended','closed','archived'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label className="assessment-field"><span>Year</span><select value={filters.year} onChange={e=>update(setFilters,'year',e.target.value)}><option value="">All years</option>{[1,2,3,4,5,6].map(y=><option key={y} value={y}>Year {y}</option>)}</select></label>
        <label className="assessment-field"><span>Batch</span><input value={filters.batch} placeholder="Batch" onChange={e=>update(setFilters,'batch',e.target.value)}/></label>
      </div>
      {!assessments.length&&<StateMessage>No assessments yet. Create a question bank first, then prepare an assessment.</StateMessage>}
      {assessments.length>0&&!filteredAssessments.length&&<StateMessage>No assessments match these filters.</StateMessage>}
      {filteredAssessments.map(a=><article className="dash-card assessment-list-card" key={a.id}>
        <div className="assessment-list-card__top"><div><div className="assessment-kicker">{a.kind.toUpperCase()} · {a.bankTitle||'Question bank unavailable'}</div>
          <h2>{a.title}</h2><p>{a.description||'No description provided.'}</p></div>{tag(displayStatus(a))}</div>
        <div className="assessment-facts"><span><strong>{a.questionCount}</strong> questions</span><span><strong>{a.totalPoints}</strong> points</span><span><strong>{a.durationMinutes}</strong> min</span><span><strong>{a.attemptCount}</strong> attempts</span></div>
        <div className="assessment-actions">
          {canManage&&a.status==='draft'&&<><Button secondary onClick={()=>editDraft(a)}>Edit draft</Button><Button disabled={busy} onClick={()=>operate(a.id,'publish')}><ShieldCheck size={15}/>Publish</Button></>}
          {canManage&&a.status==='published'&&<Button disabled={busy} secondary onClick={()=>operate(a.id,'close')}>Close assessment</Button>}
          {canRelease&&a.status==='closed'&&!a.resultsPublishedAt&&<Button disabled={busy} onClick={()=>operate(a.id,'release-results')}>Publish results</Button>}
          {a.resultsPublishedAt&&tag('results_published')}
          {canManage&&['draft','closed'].includes(a.status)&&<Button disabled={busy} secondary onClick={()=>operate(a.id,'archive')}>Archive</Button>}
          <Button secondary onClick={()=>openAttempts(a.id)}> {expanded===a.id?'Hide':'View'} submissions <ArrowRight size={15}/></Button>
        </div>
        {expanded===a.id&&<section className="assessment-attempts"><h3>Student submissions</h3>
          {!attempts.length?<p>No attempts recorded.</p>:<div className="assessment-table-wrap"><table className="dash-table"><thead><tr><th>Member</th><th>Attempt</th><th>Status</th><th>Score</th><th>Review</th></tr></thead><tbody>
            {attempts.map(item=><tr key={item.id}><td>{item.studentName}<small>{item.memberId}</small></td><td>{item.attemptNumber}</td><td>{tag(item.status)}</td><td>{item.score??'Pending'}</td><td><Button secondary onClick={()=>openReview(item.id)}>Details</Button></td></tr>)}
          </tbody></table></div>}
        </section>}
      </article>)}
    </div>}
    {!loading&&tab==='banks'&&<div className="assessment-grid">
      <section className="dash-card assessment-panel">
        <h2>Question banks</h2><p>Organize questions by academic year and student batch.</p>
        <div className="assessment-bank-list">{banks.map(item=><button key={item.id} type="button" className={item.id===activeBank?'active':''} onClick={()=>showBank(item.id)}>
          <BookOpen size={17}/><span><strong>{item.title}</strong><small>{item.academicYear?'Year '+item.academicYear:'All years'}{item.batch?' · '+item.batch:''} · {item.questionCount} questions</small></span><ArrowRight size={15}/></button>)}</div>
        {canManage&&<form onSubmit={saveBank} className="assessment-form">
          <h3>Create a question bank</h3><Field title="Bank name"><input required maxLength={120} value={bank.title} onChange={e=>update(setBank,'title',e.target.value)} placeholder="AI Fundamentals — 2026"/></Field>
          <Field title="Academic year"><select value={bank.academicYear} onChange={e=>update(setBank,'academicYear',e.target.value)}><option value="">All years</option>{[1,2,3,4,5,6].map(y=><option key={y} value={y}>Year {y}</option>)}</select></Field>
          <Field title="Student batch"><input value={bank.batch} maxLength={60} onChange={e=>update(setBank,'batch',e.target.value)} placeholder="2025–2029"/></Field>
          <Field title="Description"><textarea rows={2} value={bank.description} onChange={e=>update(setBank,'description',e.target.value)}/></Field>
          <Button type="submit" disabled={busy}><Plus size={16}/>Create bank</Button>
        </form>}
      </section>
      <section className="dash-card assessment-panel">
        {!activeBankData?<div className="assessment-placeholder"><BookOpen size={32}/><h2>Choose a question bank</h2><p>Select a bank to manage its MCQ and coding questions, or create a new bank.</p></div>:<>
          <div className="assessment-section-top"><div><span className="assessment-kicker">QUESTION LIBRARY</span><h2>{activeBankData.title}</h2><p>{questions.length} questions · {activeBankData.batch||'No batch assigned'}</p></div></div>
          {canManage&&<div className="assessment-import">
            <div className="assessment-inline-head"><FileSpreadsheet size={19}/><strong>Import from Excel</strong></div>
            <p>Upload the template, preview validation, then confirm the import.</p>
            <div className="assessment-actions"><Button secondary onClick={downloadTemplate} disabled={busy}>Download .xlsx template</Button>
              <label className="assessment-file">Choose .xlsx<input aria-label="Select Excel workbook" type="file" accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);}}/></label></div>
            {file&&<p className="assessment-file-name">{file.name}</p>}
            {file&&<div className="assessment-actions"><Button disabled={busy} onClick={()=>importFile(false)}><UploadCloud size={16}/>Validate & preview</Button>
              {preview&&<Button disabled={busy} onClick={()=>importFile(true)}><CheckCircle2 size={16}/>Import {preview.count} questions</Button>}</div>}
            {preview&&<div className="assessment-preview"><strong>{preview.count} validated questions</strong><ul>{preview.items.slice(0,4).map((item,index)=><li key={index}>{item.prompt} — {item.points} pts</li>)}</ul></div>}
          </div>}
          {canManage&&<form className="assessment-form" onSubmit={saveQuestion}>
            <div className="assessment-section-top"><h3>{editQuestion?'Edit question':'Add a question'}</h3>{editQuestion&&<Button secondary onClick={resetQuestion}>Cancel edit</Button>}</div>
            <Field title="Question type"><select value={question.kind} onChange={e=>update(setQuestion,'kind',e.target.value)}><option value="mcq">MCQ</option><option value="coding">Coding / manual review</option></select></Field>
            <Field title="Question"><textarea required maxLength={10000} rows={3} value={question.prompt} onChange={e=>update(setQuestion,'prompt',e.target.value)}/></Field>
            {question.kind==='mcq'&&<><div className="assessment-form-grid">{question.options.map((option,index)=><Field key={index} title={'Option '+String.fromCharCode(65+index)}><input required maxLength={1000} value={option} onChange={e=>setQuestion(old=>({...old,options:old.options.map((v,i)=>i===index?e.target.value:v)}))}/></Field>)}</div>
              <Field title="Correct answer"><select value={question.correctOption} onChange={e=>update(setQuestion,'correctOption',Number(e.target.value))}>{['A','B','C','D'].map((letter,index)=><option value={index} key={letter}>Option {letter}</option>)}</select></Field></>}
            {question.kind==='coding'&&<><Field title="Programming language"><input value={question.language} maxLength={60} onChange={e=>update(setQuestion,'language',e.target.value)} placeholder="Python, JavaScript, any"/></Field>
              <Field title="HackerRank link (optional)"><input type="url" value={question.externalUrl} onChange={e=>update(setQuestion,'externalUrl',e.target.value)} placeholder="https://www.hackerrank.com/..."/></Field></>}
            <Field title="Points"><input required type="number" step="0.01" min="0.01" max="10000" value={question.points} onChange={e=>update(setQuestion,'points',e.target.value)}/></Field>
            <Button type="submit" disabled={busy}>{editQuestion?'Save question':'Add question'}</Button>
          </form>}
          <div className="assessment-question-list"><h3>Questions in this bank</h3>{questions.map((q,index)=><div className="assessment-question-item" key={q.id}><span>{index+1}</span><div><strong>{q.prompt}</strong><small>{q.kind.toUpperCase()} · {q.points} points</small></div>{canManage&&<div className="assessment-actions"><Button secondary onClick={()=>{setQuestion({...q});setEditQuestion(q.id);}}>Edit</Button><Button secondary disabled={busy} onClick={()=>{if(window.confirm('Delete this bank question? Published assessments are unaffected.'))perform(async()=>{await api('/api/assessments/admin/banks/'+activeBank+'/questions/'+q.id,{method:'DELETE'});const result=await api('/api/assessments/admin/banks/'+activeBank+'/questions');setQuestions(result.items);},'Question deleted.');}}>Delete</Button></div>}</div>)}
            {!questions.length&&<p>No questions yet. Add one or import an Excel worksheet.</p>}
          </div>
        </>}
      </section>
    </div>}
    {!loading&&tab==='create'&&canManage&&<form onSubmit={saveAssessment} className="dash-card assessment-panel assessment-create">
      <div className="assessment-section-top"><div><span className="assessment-kicker">ASSESSMENT BUILDER</span><h2>{editAssessment?'Edit assessment draft':'Create a new assessment'}</h2><p>Five core settings, schedules and eligibility, with server-side validation.</p></div><Button secondary onClick={()=>setTab('assessments')}><ChevronLeft size={15}/>Back</Button></div>
      <div className="assessment-form-grid">
        <Field title="Title"><input required maxLength={160} value={form.title} onChange={e=>update(setForm,'title',e.target.value)} placeholder="AI Fundamentals Assessment"/></Field>
        <Field title="Assessment type"><select value={form.kind} onChange={e=>setForm(f=>({...f,kind:e.target.value,questionIds:[]}))}><option value="mcq">MCQ assessment</option><option value="coding">Coding (manual review)</option></select></Field>
        <Field title="Description"><textarea value={form.description} rows={2} onChange={e=>update(setForm,'description',e.target.value)}/></Field>
        <Field title="Instructions"><textarea value={form.instructions} rows={2} onChange={e=>update(setForm,'instructions',e.target.value)} placeholder="Read every question carefully..."/></Field>
      </div>
      <h3>Core assessment settings</h3>
      <div className="assessment-form-grid">
        <Field title="1. Question source" help="Choose a year-wise or batch-wise bank."><select required value={form.bankId} onChange={e=>{update(setForm,'bankId',e.target.value);setActiveBank(e.target.value);setForm(f=>({...f,bankId:e.target.value,questionIds:[]}));}}>
          <option value="">Choose a question bank</option>{banks.map(b=><option key={b.id} value={b.id}>{b.title} ({b.questionCount} total questions)</option>)}</select></Field>
        <Field title="2. Number of questions"><input required type="number" min="1" max="200" value={form.questionCount} onChange={e=>setForm(f=>({...f,questionCount:e.target.value,questionIds:[]}))}/></Field>
        <Field title="3. Backward navigation"><select value={form.allowBackward?'yes':'no'} onChange={e=>update(setForm,'allowBackward',e.target.value==='yes')}><option value="yes">Yes — previous questions accessible</option><option value="no">No — questions lock after Next</option></select></Field>
        <Field title="4. Point allocation"><select value={form.pointsMode} onChange={e=>update(setForm,'pointsMode',e.target.value)}><option value="equal">Equal marks per question</option><option value="custom">Custom marks from question bank</option></select></Field>
        <Field title="5. Total Points" help={form.pointsMode==='equal'?'Each question receives Total Points ÷ Question Count.':'Must match the sum of chosen bank-question points.'}>
          <input required type="number" step="0.01" min="0.01" value={form.totalPoints} onChange={e=>update(setForm,'totalPoints',e.target.value)}/></Field>
        <div className="assessment-calculation"><span>Selected questions</span><strong>{chosenQuestions.length} / {form.questionCount}</strong><span>Bank question-point sum</span><strong>{Math.round(totalFromQuestions*100)/100}</strong>
          {form.pointsMode==='equal'&&<><span>Points per question</span><strong>{Math.round(Number(form.totalPoints)/Number(form.questionCount)*100)/100 || '—'}</strong></>}</div>
      </div>
      {form.bankId&&<section className="assessment-picker"><h3>Choose specific questions (optional)</h3><p>Without a selection, the first matching questions in the bank will be used. Choose exactly {form.questionCount} to customize the set.</p>
        <div className="assessment-actions">
          <Button secondary disabled={!matchingQuestions.length||matchingQuestions.length>200||form.questionIds.length===matchingQuestions.length} onClick={()=>setForm(current=>({ ...current,questionIds:matchingQuestions.map(q=>q.id),questionCount:matchingQuestions.length }))}>Select all questions ({matchingQuestions.length})</Button>
          <Button secondary disabled={!form.questionIds.length} onClick={()=>setForm(current=>({ ...current,questionIds:[] }))}>Clear selection</Button>
        </div>
        {matchingQuestions.length>200&&<p>Assessments support up to 200 questions. Select up to 200 questions individually.</p>}
        {matchingQuestions.length===0&&<p>No {form.kind} questions available in this bank.</p>}
        <div className="assessment-pick-list">{matchingQuestions.map((q,index)=><label key={q.id}><input type="checkbox" checked={form.questionIds.includes(q.id)} onChange={e=>setForm(f=>({...f,questionIds:e.target.checked?[...f.questionIds,q.id]:f.questionIds.filter(id=>id!==q.id)}))}/><span>{index+1}. {q.prompt}</span><small>{q.points} pts</small></label>)}</div>
        <p>Selected: {form.questionIds.length}. {form.questionIds.length===0?'Automatic bank order is active.':''}</p>
      </section>}
      <h3>Timing and eligibility</h3>
      <div className="assessment-form-grid">
        <Field title="Duration (minutes)"><input required type="number" min="1" max="360" value={form.durationMinutes} onChange={e=>update(setForm,'durationMinutes',e.target.value)}/></Field>
        <Field title="Attempt limit"><input required type="number" min="1" max="10" value={form.attemptLimit} onChange={e=>update(setForm,'attemptLimit',e.target.value)}/></Field>
        <Field title="Opens at (optional)"><input type="datetime-local" value={form.startAt} onChange={e=>update(setForm,'startAt',e.target.value)}/></Field>
        <Field title="Closes at (optional)"><input type="datetime-local" value={form.endAt} onChange={e=>update(setForm,'endAt',e.target.value)}/></Field>
        <Field title="Eligible academic year"><select value={form.eligibilityYear} onChange={e=>update(setForm,'eligibilityYear',e.target.value)}><option value="">All academic years</option>{[1,2,3,4,5,6].map(y=><option key={y} value={y}>Year {y}</option>)}</select></Field>
      </div>
      <div className="assessment-actions assessment-submit"><Button secondary onClick={()=>setTab('assessments')}>Cancel</Button><Button type="submit" disabled={busy}><ClipboardList size={16}/>{busy?'Saving...':'Save draft'}</Button></div>
    </form>}
    {review&&<div className="assessment-dialog-backdrop" role="presentation"><section className="assessment-review" role="dialog" aria-modal="true" aria-label="Attempt review"><div className="assessment-section-top">
      <h2>Attempt review</h2><Button secondary onClick={()=>setReview(null)}>Close</Button></div>
      <p>Status: {review.attempt.status}. Score: {review.attempt.score??'Awaiting grading'}.</p>
      {review.questions.map(q=><ReviewQuestion key={q.id} question={q} canGrade={canGrade} busy={busy} onGrade={gradeQuestion}/>)}
    </section></div>}
  </DashboardShell>;
}
function ReviewQuestion({question:q,canGrade,busy,onGrade}) {
  const [points,setPoints]=useState(q.awardedPoints??0),[feedback,setFeedback]=useState(q.feedback||'');
  return <section className="assessment-review-question"><h3>{q.prompt}</h3><p>Maximum: {q.points} points</p>
    {q.kind==='mcq'?<p>Student answer: {q.selectedOption===null?'Unanswered':'Option '+String.fromCharCode(65+q.selectedOption)} · Correct: Option {String.fromCharCode(65+q.correctOption)}</p>:<>
      {q.externalUrl&&<a href={q.externalUrl} target="_blank" rel="noopener noreferrer">Open HackerRank exercise</a>}
      <pre>{q.codeAnswer||'No answer submitted.'}</pre>
      {canGrade&&<div className="assessment-form"><Field title="Awarded points"><input type="number" min="0" max={q.points} step="0.01" value={points} onChange={e=>setPoints(e.target.value)}/></Field>
        <Field title="Feedback"><textarea rows={3} value={feedback} onChange={e=>setFeedback(e.target.value)}/></Field><Button disabled={busy} onClick={()=>onGrade(q,points,feedback)}>Save grade</Button></div>}
    </>}
  </section>;
}
