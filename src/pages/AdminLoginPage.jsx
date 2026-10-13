import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UserCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import './AdminLoginPage.css';

export default function AdminLoginPage() {
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  function selectRole(nextRole) {
    setRole(nextRole);
    setMessage('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('Secure ' + role + ' authentication is ready to be connected to the backend.');
  }

  return (
    <main className="admin-login">
      <section className="admin-login__visual" aria-label="AI Club member access">
        <div className="admin-login__ambient" aria-hidden="true">
          <span className="admin-node admin-node--one"/>
          <span className="admin-node admin-node--two"/>
          <span className="admin-node admin-node--three"/>
          <span className="admin-node admin-node--four"/>
          <i className="admin-orbit admin-orbit--one"/>
          <i className="admin-orbit admin-orbit--two"/>
        </div>

        <Link to="/" className="admin-brand" aria-label="Return to AI Club home">
          <img src="/ai-club-emblem.png" alt=""/>
          <span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span>
        </Link>

        <div className="admin-login__story">
          <div className="admin-login__eyebrow"><Sparkles size={14}/> AI CLUB MEMBER NETWORK</div>
          <h1>One club.<br/><em>One place to begin.</em></h1>
          <p>A shared secure workspace where students take assessments, track their progress and build—while administrators guide the community.</p>
          <div className="admin-login__trust">
            <span><GraduationCap size={17}/> Student assessment access</span>
            <span><ShieldCheck size={17}/> Protected admin controls</span>
          </div>
        </div>

        <footer>AI CLUB MEMBER SYSTEM <span/> SECURE ACCESS</footer>
      </section>

      <section className="admin-login__form-side">
        <Link to="/" className="admin-login__back"><ArrowLeft size={16}/> Back to website</Link>

        <div className="admin-login__card">
          <div className="admin-login__card-icon"><KeyRound size={24}/></div>
          <span className="admin-login__label">SECURE PORTAL</span>
          <h2>Welcome back.</h2>
          <p className="admin-login__intro">Choose your account type and enter your credentials.</p>

          <div className="admin-role-switch" role="group" aria-label="Choose account type">
            <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => selectRole('student')} aria-pressed={role === 'student'}><GraduationCap size={17}/><span>Student</span></button>
            <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => selectRole('admin')} aria-pressed={role === 'admin'}><UserCog size={17}/><span>Admin</span></button>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="member-email">{role === 'student' ? 'Student email address' : 'Administrator email address'}</label>
            <div className="admin-field">
              <Mail size={18}/>
              <input id="member-email" name="email" type="email" autoComplete="username" placeholder={role === 'student' ? 'student@srishakthi.ac.in' : 'admin@srishakthi.ac.in'} required/>
            </div>

            <div className="admin-password-row">
              <label htmlFor="member-password">Password</label>
              <button type="button">Forgot password?</button>
            </div>
            <div className="admin-field">
              <LockKeyhole size={18}/>
              <input id="member-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required minLength={8}/>
              <button type="button" className="admin-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>

            <label className="admin-remember">
              <input type="checkbox" name="remember"/>
              <span><i><CheckMark/></i></span>
              Keep me signed in on this device
            </label>

            <button type="submit" className="admin-login__submit">Continue as {role} <ArrowRight size={17}/></button>
            <p className="admin-login__message" role="status">{message}</p>
          </form>

          <div className="admin-login__security"><ShieldCheck size={15}/><span>Your credentials will be encrypted and routed to the correct workspace once authentication is connected.</span></div>
        </div>

        <p className="admin-login__help">Need access? Contact the AI Club faculty coordinator.</p>
      </section>
    </main>
  );
}

function CheckMark() {
  return <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5.2 4.2 8.5 11 1.5"/></svg>;
}
