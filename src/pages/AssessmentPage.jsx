import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, Check, CheckCircle2, ChevronRight, Clock3, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import './AssessmentPage.css';

const LEVELS = [
  { title:'AI Foundations', focus:'Core concepts, intelligent systems and everyday AI.', questions:[
    ['Which description best matches artificial intelligence?',['A database that only stores files','Systems designed to perform tasks that usually require human intelligence','Any program connected to the internet','A faster computer processor'],1],
    ['Machine learning is best understood as…',['A way for systems to learn patterns from data','A method for manually writing every rule','A type of computer hardware','A file-compression technique'],0],
    ['Which is an example of generative AI?',['A calculator adding two numbers','A system creating an image from a text prompt','A USB drive copying a file','A router forwarding traffic'],1],
  ]},
  { title:'Python Logic', focus:'Variables, control flow, functions and problem solving.', questions:[
    ['What does a Python function primarily help you do?',['Store images permanently','Group reusable logic','Increase screen resolution','Design a network cable'],1],
    ['Which structure repeats a block of code?',['A loop','A string','A comment','A constant'],0],
    ['What is the result of len([4, 7, 9])?',['2','3','4','20'],1],
  ]},
  { title:'Data Literacy', focus:'Datasets, preparation, features and meaningful evidence.', questions:[
    ['Why is data cleaning important?',['It makes every model perfect','It reduces errors and inconsistencies before analysis','It removes the need for testing','It guarantees more data'],1],
    ['A feature in a dataset is…',['An input variable used by a model','The final deployed website','A password','A programming language'],0],
    ['Which split is used to estimate performance on unseen data?',['Training set only','Test set','Duplicate set','Archive set'],1],
  ]},
  { title:'Machine Learning', focus:'Training, evaluation, prediction and model behaviour.', questions:[
    ['Supervised learning uses…',['Labelled examples','No data','Only random numbers','Hardware instructions'],0],
    ['Overfitting happens when a model…',['Learns training details but generalises poorly','Uses too little electricity','Has no parameters','Runs in a browser'],0],
    ['Which metric is commonly used for classification?',['Accuracy','File size','Clock speed','Screen width'],0],
  ]},
  { title:'Deep Learning', focus:'Neural networks, representations and modern architectures.', questions:[
    ['A neural network is built from connected…',['Layers of computational units','Folders and files','Browser tabs','Database passwords'],0],
    ['What does an activation function add?',['Non-linearity','More storage','A network cable','A new dataset automatically'],0],
    ['CNNs are strongly associated with…',['Image understanding','Spreadsheet formatting','Email delivery','Disk encryption'],0],
  ]},
  { title:'Applied AI', focus:'Computer vision, language models and solution design.', questions:[
    ['Computer vision primarily works with…',['Images and video','Only audio cables','Database passwords','Keyboard layouts'],0],
    ['NLP focuses on…',['Human language','Processor temperature','File permissions','Screen brightness'],0],
    ['Retrieval-augmented generation adds…',['Relevant external context to a model response','More pixels to an image','A faster keyboard','Random labels'],0],
  ]},
  { title:'Responsible AI', focus:'Bias, privacy, safety and accountable deployment.', questions:[
    ['A biased dataset can lead to…',['Unfair model outcomes','Guaranteed accuracy','Zero maintenance','Smaller monitors'],0],
    ['Data minimisation means…',['Collecting only what is necessary','Collecting everything available','Deleting all results','Avoiding consent'],0],
    ['Human oversight is valuable because it…',['Supports review and accountability','Makes evaluation unnecessary','Removes all risk automatically','Replaces documentation'],0],
  ]},
  { title:'Build Challenge', focus:'Combine the full pathway into a practical AI solution.', questions:[
    ['What should come first in an AI project?',['A clear problem definition','A polished logo','The largest possible model','Deployment without testing'],0],
    ['A useful prototype should be evaluated against…',['Defined success criteria','Only its colour palette','The number of files','Random opinions alone'],0],
    ['Before deployment, a team should check…',['Performance, safety and user impact','Only the project name','Only training speed','Nothing after coding'],0],
  ]},
];

const STORAGE_KEY = 'ai-club-assessment-progress';

export default function AssessmentPage() {
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const progress = Math.round((completed.length / LEVELS.length) * 100);
  const eligible = completed.length === LEVELS.length;
  const activeLevel = active === null ? null : LEVELS[active];

  useEffect(() => {
    if (active === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = event => { if (event.key === 'Escape') closeAssessment(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [active]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  function openAssessment(index) {
    if (index > 0 && !completed.includes(index - 1)) return;
    setActive(index);
    setAnswers({});
    setResult(null);
  }

  function closeAssessment() {
    setActive(null);
    setAnswers({});
    setResult(null);
  }

  function submitAssessment() {
    if (!activeLevel || answeredCount !== activeLevel.questions.length) return;
    const score = activeLevel.questions.reduce((total, question, index) => total + (answers[index] === question[2] ? 1 : 0), 0);
    const passed = score >= 2;
    setResult({ score, passed });
    if (passed && !completed.includes(active)) {
      const next = [...completed, active].sort((a,b) => a-b);
      setCompleted(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }

  function resetProgress() {
    setCompleted([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="assessment-page">
      <section className="assessment-hero">
        <div className="cin-shell assessment-hero__inner">
          <div className="assessment-eyebrow"><Sparkles size={14}/> AI CLUB / ENTRY PROTOCOL</div>
          <h1>Eight levels.<br/><em>One way in.</em></h1>
          <p>Prove your fundamentals, build your judgment and progress through an assessment pathway designed for future AI builders.</p>
          <div className="assessment-hero__meta">
            <span><strong>08</strong> progressive levels</span>
            <span><strong>{progress}%</strong> pathway complete</span>
            <span><strong>{eligible ? 'READY' : 'ACTIVE'}</strong> entry status</span>
          </div>
        </div>
      </section>

      <section className="assessment-dashboard">
        <div className="cin-shell">
          <div className="assessment-progress">
            <div>
              <span>YOUR PROGRESS</span>
              <h2>{eligible ? 'Entry pathway complete.' : 'Level ' + Math.min(completed.length + 1, 8) + ' is ready.'}</h2>
              <p>{eligible ? 'You have cleared all eight assessment levels and are eligible for the next club-entry step.' : 'Pass each level to unlock the next. Your progress is saved on this device.'}</p>
            </div>
            <div className="assessment-progress__meter">
              <div className="assessment-progress__ring" style={{'--progress': (progress * 3.6) + 'deg'}} aria-label={progress + '% complete'}><strong>{progress}%</strong><span>COMPLETE</span></div>
              {completed.length > 0 && <button onClick={resetProgress}><RotateCcw size={14}/> Reset</button>}
            </div>
          </div>

          <div className="assessment-path" aria-label="Assessment levels">
            {LEVELS.map((level, index) => {
              const done = completed.includes(index);
              const unlocked = index === 0 || completed.includes(index - 1);
              return <article className={'assessment-level' + (done ? ' is-complete' : '') + (unlocked ? ' is-unlocked' : ' is-locked')} key={level.title}>
                <div className="assessment-level__top">
                  <span className="assessment-level__number">{String(index + 1).padStart(2,'0')}</span>
                  <span className="assessment-level__state">{done ? <><CheckCircle2 size={14}/> PASSED</> : unlocked ? <><BrainCircuit size={14}/> AVAILABLE</> : <><LockKeyhole size={14}/> LOCKED</>}</span>
                </div>
                <div className="assessment-level__line"><span/></div>
                <h3>{level.title}</h3>
                <p>{level.focus}</p>
                <div className="assessment-level__details"><span><Clock3 size={14}/> 3 questions</span><span><ShieldCheck size={14}/> 2/3 to pass</span></div>
                <button disabled={!unlocked} onClick={() => openAssessment(index)}>
                  {done ? 'Retake level' : unlocked ? 'Start assessment' : 'Complete level ' + index}
                  {unlocked ? <ArrowRight size={16}/> : <LockKeyhole size={14}/>}
                </button>
              </article>;
            })}
          </div>

          <div className={'assessment-entry' + (eligible ? ' is-ready' : '')}>
            <div className="assessment-entry__icon">{eligible ? <Check size={28}/> : <ShieldCheck size={28}/>}</div>
            <div><span>CLUB ENTRY</span><h2>{eligible ? 'Assessment pathway cleared' : 'Complete all eight levels'}</h2><p>{eligible ? 'Your result is ready for verification by the AI Club team.' : 'Every level tests a different layer of the knowledge and judgment needed to contribute responsibly.'}</p></div>
            <ChevronRight size={24}/>
          </div>
        </div>
      </section>

      {activeLevel && <div className="assessment-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-title">
        <button className="assessment-modal__backdrop" aria-label="Close assessment" onClick={closeAssessment}/>
        <section className="assessment-modal__panel">
          <button className="assessment-modal__close" onClick={closeAssessment} aria-label="Close"><X size={20}/></button>
          <div className="assessment-modal__head">
            <span>LEVEL {String(active + 1).padStart(2,'0')}</span>
            <h2 id="assessment-title">{activeLevel.title}</h2>
            <p>{result ? 'Assessment result' : answeredCount + ' of ' + activeLevel.questions.length + ' answered'}</p>
          </div>

          {!result ? <div className="assessment-questions">
            {activeLevel.questions.map((question, questionIndex) => <fieldset key={question[0]}>
              <legend><span>{questionIndex + 1}</span>{question[0]}</legend>
              <div>{question[1].map((option, optionIndex) => <label className={answers[questionIndex] === optionIndex ? 'selected' : ''} key={option}>
                <input type="radio" name={'question-' + questionIndex} checked={answers[questionIndex] === optionIndex} onChange={() => setAnswers(current => ({...current, [questionIndex]: optionIndex}))}/>
                <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
              </label>)}</div>
            </fieldset>)}
            <button className="assessment-submit" disabled={answeredCount !== activeLevel.questions.length} onClick={submitAssessment}>Submit level <ArrowRight size={17}/></button>
          </div> : <div className={'assessment-result ' + (result.passed ? 'passed' : 'retry')}>
            <div>{result.passed ? <CheckCircle2 size={42}/> : <RotateCcw size={42}/>}</div>
            <span>{result.passed ? 'LEVEL CLEARED' : 'TRY AGAIN'}</span>
            <h3>{result.score} / {activeLevel.questions.length}</h3>
            <p>{result.passed ? active === 7 ? 'All eight levels are complete. Your club-entry status is now ready.' : 'Level ' + (active + 2) + ' is now unlocked.' : 'Review the concepts and retake this level. You need two correct answers to progress.'}</p>
            <button onClick={result.passed ? closeAssessment : () => { setAnswers({}); setResult(null); }}>{result.passed ? 'Return to pathway' : 'Retake assessment'} <ArrowRight size={16}/></button>
          </div>}
        </section>
      </div>}
    </main>
  );
}
