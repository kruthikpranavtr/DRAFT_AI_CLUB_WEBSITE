import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import './AdminLoginPage.css';

export default function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('Authentication service is ready to be connected to the admin backend.');
  }

  return (
    <main className="admin-login">
      <section className="admin-login__visual" aria-label="AI Club administration">
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
          <div className="admin-login__eyebrow"><Sparkles size={14}/> ADMINISTRATIVE NETWORK</div>
          <h1>Lead the club.<br/><em>Shape what comes next.</em></h1>
          <p>A secure workspace for managing assessments, student progress, club activity and the stories shared with the community.</p>
          <div className="admin-login__trust">
            <span><ShieldCheck size={17}/> Protected administrative access</span>
            <span><LockKeyhole size={17}/> Authorized members only</span>
          </div>
        </div>

        <footer>AI CLUB ADMIN SYSTEM <span/> SECURE ACCESS</footer>
      </section>

      <section className="admin-login__form-side">
        <Link to="/" className="admin-login__back"><ArrowLeft size={16}/> Back to website</Link>

        <div className="admin-login__card">
          <div className="admin-login__card-icon"><KeyRound size={24}/></div>
          <span className="admin-login__label">ADMIN PORTAL</span>
          <h2>Welcome back.</h2>
          <p className="admin-login__intro">Sign in with your authorized administrator account.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="admin-email">Email address</label>
            <div className="admin-field">
              <Mail size={18}/>
              <input id="admin-email" name="email" type="email" autoComplete="username" placeholder="admin@aiclub.edu" required/>
            </div>

            <div className="admin-password-row">
              <label htmlFor="admin-password">Password</label>
              <button type="button">Forgot password?</button>
            </div>
            <div className="admin-field">
              <LockKeyhole size={18}/>
              <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required minLength={8}/>
              <button type="button" className="admin-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>

            <label className="admin-remember">
              <input type="checkbox" name="remember"/>
              <span><i><CheckMark/></i></span>
              Keep me signed in on this device
            </label>

            <button type="submit" className="admin-login__submit">Sign in to dashboard <ArrowRight size={17}/></button>
            <p className="admin-login__message" role="status">{message}</p>
          </form>

          <div className="admin-login__security"><ShieldCheck size={15}/><span>Your credentials will be encrypted and verified securely once authentication is connected.</span></div>
        </div>

        <p className="admin-login__help">Need access? Contact the AI Club faculty coordinator.</p>
      </section>
    </main>
  );
}

function CheckMark() {
  return <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5.2 4.2 8.5 11 1.5"/></svg>;
}
