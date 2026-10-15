import { ArrowLeft,ArrowRight,CheckCircle2,Clock3,Code2,FileQuestion,LockKeyhole,Play,RefreshCcw,Send } from 'lucide-react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { PageHead,StateMessage } from './StudentDashboardPage';
import './Assessments.css';

function Status({ value }) {return <span className={'assessment-tag is-'+value}>{value.replaceAll('_',' ')}</span>;}
function prettyDate(value) {return value ? new Date(value).toLocaleString() : 'No deadline';}
export default function StudentAssessmentsPage() {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const [history,setHistory]=useState({});
  const navigate=useNavigate();
  const load=useCallback(async()=>{
    setLoading(true);
    try {const response=await api('/api/assessments/student');setItems(response.items);setError('');}
    catch(cause){setError(cause.message);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  async function openHistory(id) {
    if (history[id]) {setHistory(old=>({...old,[id]:null}));return;}
    try {const data=await api('/api/assessments/student/'+id+'/history');setHistory(old=>({...old,[id]:data.items}));}
    catch(cause){setError(cause.message);}
  }
  async function start(id) {
    setBusy(id);setError('');
    try {
      const data=await api('/api/assessments/student/'+id+'/start',{method:'POST'});
      navigate('/student/assessments/attempt/'+data.attempt.id);
    }catch(cause){setError(cause.message);}
    finally{setBusy('');}
  }
  return <DashboardShell section="Assessments">
    <PageHead eyebrow="YOUR ASSESSMENTS" title="Assessments." text="Find available tests, continue an attempt, and view results when your administrator releases them."/>
    {error&&<StateMessage tone="error">{error}</StateMessage>}
    {loading&&<StateMessage>Loading assessments...</StateMessage>}
    {!loading&&!items.length&&<StateMessage>No assessments are available for your academic year yet.</StateMessage>}
    <div className="assessment-student-grid">{items.map(a=><article className="dash-card assessment-student-card" key={a.id}>
      <div className="assessment-student-icon">{a.kind==='mcq'?<FileQuestion size={20}/>:<Code2 size={20}/>}</div>
      <div className="assessment-section-top"><span className="assessment-kicker">{a.kind==='mcq'?'MULTIPLE CHOICE':'CODING / MANUAL REVIEW'}</span><Status value={a.availability}/></div>
      <h2>{a.title}</h2><p>{a.description||'Read the instructions before starting.'}</p>
      <div className="assessment-student-metrics"><span>{a.questionCount} questions</span><span>{a.totalPoints} points</span><span><Clock3 size={14}/>{a.durationMinutes} min</span></div>
      <div className="assessment-student-dates"><div>Opens: <strong>{a.startAt?prettyDate(a.startAt):'Immediately'}</strong></div><div>Closes: <strong>{prettyDate(a.endAt)}</strong></div>
        <div>Attempts: <strong>{a.attemptsUsed} / {a.attemptLimit}</strong></div></div>
      {a.latestAttempt?.resultsAvailable&&<div className="assessment-result-small"><CheckCircle2 size={17}/><strong>{a.latestAttempt.graded?'Score: '+a.latestAttempt.score+' / '+a.totalPoints:'Awaiting review'}</strong></div>}
      <div className="assessment-actions">
        {a.latestAttempt?.status==='in_progress'&&<Link className="dash-action" to={'/student/assessments/attempt/'+a.latestAttempt.id}>Continue attempt <ArrowRight size={16}/></Link>}
        {a.availability==='active'&&a.latestAttempt?.status!=='in_progress'&&a.attemptsUsed<a.attemptLimit&&<button type="button" className="dash-action" disabled={busy===a.id} onClick={()=>start(a.id)}><Play size={15}/>{busy===a.id?'Starting...':'Start assessment'}</button>}
        {a.latestAttempt?.status==='submitted'&&<span className="assessment-completed"><CheckCircle2 size={16}/>Submitted</span>}
        {a.availability==='upcoming'&&<span className="assessment-locked"><LockKeyhole size={15}/>Not open yet</span>}
        {a.attemptsUsed>0&&<button className="portal-secondary-button" type="button" onClick={()=>openHistory(a.id)}> {history[a.id]?'Hide':'View'} history</button>}
      </div>
      {history[a.id]&&<div className="assessment-history"><strong>Attempt history</strong>{history[a.id].map(item=><div key={item.id}><span>Attempt {item.attemptNumber} · {item.status}</span><span>{item.resultsAvailable?(item.graded?item.score+' / '+a.totalPoints:'Awaiting review'):'Results not published'}</span></div>)}</div>}
    </article>)}</div>
  </DashboardShell>;
}
export function StudentAssessmentAttemptPage() {
  const { attemptId }=useParams();
  const [payload,setPayload]=useState(null),[answers,setAnswers]=useState({}),[position,setPosition]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [nowMs,setNowMs]=useState(Date.now()),[submitted,setSubmitted]=useState(false),[saved,setSaved]=useState('');
  const submitting=useRef(false);
  const refresh=useCallback(async()=>{
    const result=await api('/api/assessments/student/attempts/'+attemptId);
    setPayload(result);
    setAnswers(Object.fromEntries(result.answers.map(a=>[a.questionId,{ selectedOption:a.selectedOption,codeAnswer:a.codeAnswer||'' }])));
    setPosition(current=>result.assessment.allowBackward ? Math.min(current,result.questions.length-1):result.attempt.furthestPosition);
    if (result.attempt.status==='submitted') setSubmitted(true);
    return result;
  },[attemptId]);
  useEffect(()=>{
    let active=true;
    refresh().catch(cause=>{if(active)setError(cause.message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[refresh]);
  useEffect(()=>{
    const timer=setInterval(()=>setNowMs(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[]);
  const assessment=payload?.assessment,attempt=payload?.attempt;
  const current=payload?.questions[position];
  const remaining=attempt ? Math.max(0,Math.ceil((Date.parse(attempt.expiresAt)-nowMs)/1000)) : 0;
  const timeLabel=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  const completed=useMemo(()=>{
    const answered=new Set(payload?.answeredPositions||[]);
    for (const [id,answer] of Object.entries(answers)) {
      if (answer?.selectedOption!==null&&answer?.selectedOption!==undefined||Boolean(answer?.codeAnswer?.trim())) {
        const question=payload?.questions.find(q=>q.id===id);
        if (question) answered.add(question.position);
      }
    }
    return answered.size;
  },[answers,payload]);
  async function saveCurrent() {
    if(!current||current.locked||!attempt||attempt.status!=='in_progress') return;
    const value=answers[current.id] || {};
    const body=current.kind==='mcq'?{ selectedOption:value.selectedOption??null }:{ codeAnswer:value.codeAnswer||'' };
    setSaving(true);setSaved('');
    try {
      await api('/api/assessments/student/attempts/'+attemptId+'/answers/'+current.id,{method:'PUT',body:JSON.stringify(body)});
      setSaved('Saved');setError('');
    }finally{setSaving(false);}
  }
  async function selectOption(value) {
    if(!current||current.locked) return;
    setAnswers(prev=>({...prev,[current.id]:{ selectedOption:value }}));
    setSaving(true);setSaved('');
    try {
      await api('/api/assessments/student/attempts/'+attemptId+'/answers/'+current.id,
        {method:'PUT',body:JSON.stringify({selectedOption:value})});
      setSaved('Saved');
    }catch(cause){setError(cause.message);}finally{setSaving(false);}
  }
  async function next() {
    if (!payload || saving) return;
    try {
      if(current&&!current.locked) await saveCurrent();
      if (!assessment.allowBackward) {
        await api('/api/assessments/student/attempts/'+attemptId+'/advance',{method:'POST'});
        await refresh();
      } else setPosition(v=>Math.min(payload.questions.length-1,v+1));
    }catch(cause){setError(cause.message);}
  }
  async function finish(automatic=false) {
    if(submitting.current||!attempt||attempt.status==='submitted') return;
    if(!automatic&&!window.confirm('Submit your assessment? You cannot change your answers afterward.')) return;
    submitting.current=true;setSaving(true);setError('');
    try {
      if (!automatic && current && !current.locked) await saveCurrent();
      await api('/api/assessments/student/attempts/'+attemptId+'/submit',{method:'POST'});
      await refresh();setSubmitted(true);
    } catch(cause) {setError(cause.message);await refresh().catch(()=>{});}
    finally { submitting.current=false;setSaving(false); }
  }
  useEffect(()=>{
    if(attempt?.status==='in_progress'&&remaining===0&&!submitting.current) finish(true);
  // Auto-submit is tied to the settled attempt and countdown, not answer edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[remaining,attempt?.status]);
  return <DashboardShell section="Assessment attempt">
    <PageHead eyebrow="SECURE ASSESSMENT" title={assessment?.title||'Assessment attempt'} text={assessment?.instructions||'Your answers save to the server. Submit before the countdown ends.'} action={<Link className="portal-secondary-button" to="/student/assessments"><ArrowLeft size={16}/>All assessments</Link>}/>
    {error&&<StateMessage tone="error">{error}</StateMessage>}
    {loading&&<StateMessage>Loading secure assessment...</StateMessage>}
    {!loading&&submitted&&<section className="dash-card assessment-finished"><CheckCircle2 size={40}/><h2>Assessment submitted.</h2>
      <p>Your responses have been recorded. {attempt?.resultsAvailable?(attempt.graded?'Your score is '+attempt.score+' out of '+assessment.totalPoints+'.':'Your coding submission is awaiting review.'):'Your result will appear only after an administrator publishes it.'}</p>
      <Link className="dash-action" to="/student/assessments">Return to assessments <ArrowRight size={16}/></Link>
    </section>}
    {!loading&&payload&&!submitted&&<div className="assessment-test-layout">
      <section className="dash-card assessment-test-main">
        <div className="assessment-test-info"><span>QUESTION {position+1} OF {payload.questions.length}</span><div className={remaining<60?'assessment-countdown is-urgent':'assessment-countdown'}><Clock3 size={18}/><strong>{timeLabel}</strong><small>remaining</small></div></div>
        <div className="assessment-progress-line"><span style={{width:((position+1)/payload.questions.length*100)+'%'}}/></div>
        {current&&!current.locked&&<><div className="assessment-question-body"><span className="assessment-kicker">{current.kind.toUpperCase()} · {current.points} POINTS</span><h2>{current.prompt}</h2>
          {current.kind==='mcq'?<fieldset className="assessment-options"><legend className="assessment-sr-only">Choose your answer</legend>{current.options.map((option,index)=><label className={answers[current.id]?.selectedOption===index?'selected':''} key={index}>
            <input type="radio" name={'question-'+current.id} checked={answers[current.id]?.selectedOption===index} onChange={()=>selectOption(index)}/>
            <span className="assessment-option-letter">{String.fromCharCode(65+index)}</span><span>{option}</span></label>)}</fieldset>
            :<><p>Language: {current.language||'Any language'}</p>{current.externalUrl&&<a href={current.externalUrl} target="_blank" rel="noopener noreferrer" className="assessment-external-link">Open HackerRank exercise <ArrowRight size={15}/></a>}
              <label className="assessment-field"><span>Your code / written solution</span><textarea rows={13} spellCheck={false} value={answers[current.id]?.codeAnswer||''} onChange={e=>{setAnswers(a=>({...a,[current.id]:{codeAnswer:e.target.value}}));setSaved('Unsaved changes');}} onBlur={()=>saveCurrent().catch(cause=>setError(cause.message))}/></label></>}
        </div><div className="assessment-test-footer">
          <span aria-live="polite">{saving?'Saving...':saved||'Answers stored securely'}</span>
          <div className="assessment-actions">{assessment.allowBackward&&position>0&&<button className="portal-secondary-button" onClick={()=>setPosition(v=>v-1)}><ArrowLeft size={15}/>Previous</button>}
            {position<payload.questions.length-1?<button className="dash-action" onClick={next} disabled={saving}>Next <ArrowRight size={16}/></button>
            :<button className="dash-action" disabled={saving} onClick={()=>finish(false)}><Send size={16}/>Submit assessment</button>}</div>
        </div></>}
      </section>
      <aside className="dash-card assessment-test-sidebar"><h2>Question progress</h2><p>{completed} answered · {payload.questions.length} total</p>
        <div className="assessment-number-grid">{payload.questions.map((question,index)=><button type="button" key={question.id} disabled={!assessment.allowBackward} onClick={()=>setPosition(index)}
          className={(position===index?'current ':'')+((payload.answeredPositions||[]).includes(index)||answers[question.id]!==undefined?'answered':'')} aria-label={'Question '+(index+1)} aria-current={index===position?'step':undefined}>{index+1}</button>)}</div>
        {!assessment.allowBackward&&<div className="assessment-info-note"><LockKeyhole size={17}/>Backward navigation is disabled for this assessment. Only the current question is accessible.</div>}
        <div className="assessment-info-note"><RefreshCcw size={17}/>MCQ answers save when selected. Coding responses save when you leave the editor or move to another question.</div>
      </aside>
    </div>}
  </DashboardShell>;
}
