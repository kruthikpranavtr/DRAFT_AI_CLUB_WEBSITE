import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, Mail, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import InnovationCampus from './InnovationCampus';
import './PortalAuth.css';

export function PortalLoginLayout({ eyebrow, title, story, backLabel, backTo, children }) {
  return <main className="admin-login">
    <section className="admin-login__visual" aria-label={eyebrow}>
      <Link to="/" className="admin-brand">
        <img src="/ai-club-new-logo.png" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/ai-club-emblem.png'; }} alt=""/>
        <span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span>
      </Link>
      <InnovationCampus />
      <div className="admin-login__story">
        <span className="admin-login__eyebrow">{eyebrow}</span>
        <h2>{title === 'Your club' ? <>Your <em>club</em></> : title}</h2>
        <p>{story}</p>
        <div className="admin-login__trust">
          <span><ShieldCheck size={17} aria-hidden="true"/> Protected member spaces</span>
          <span><KeyRound size={17} aria-hidden="true"/> Server-enforced access</span>
        </div>
      </div>
      <footer>AI CLUB MEMBER PLATFORM <span aria-hidden="true">/</span> SRI SHAKTHI</footer>
    </section>
    <section className="admin-login__form-side">
      <Link to={backTo} className="admin-login__back"><ArrowLeft size={16} aria-hidden="true"/> {backLabel}</Link>
      <div className="admin-login__card">{children}</div>
      <p className="admin-login__help">Access issues? Contact the AI Club faculty coordinator.</p>
    </section>
  </main>;
}

export function LoginForm({ identifier, setIdentifier, password, setPassword, remember, setRemember, showPassword, setShowPassword, status, setStatus, submitting, handleSubmit }) {
  return <form onSubmit={handleSubmit}>
    <label htmlFor="portal-identifier">Roll number, admin ID, or email</label>
    <div className="admin-field"><Mail size={17} aria-hidden="true"/>
      <input id="portal-identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={160} placeholder="Enter your roll number, ID, or email" value={identifier} onChange={event => { setIdentifier(event.target.value); setStatus(null); }} required/>
    </div>
    <div className="admin-password-row"><label htmlFor="portal-password">Password</label></div>
    <div className="admin-field"><LockKeyhole size={17} aria-hidden="true"/>
      <input id="portal-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => { setPassword(event.target.value); setStatus(null); }} required minLength={8} maxLength={200}/>
      <button type="button" className="admin-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="portal-password">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
    </div>
    <label className="admin-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)}/>Keep me signed in on this device</label>
    <button type="submit" className="admin-login__submit" disabled={submitting}>{submitting ? 'Verifying...' : 'Sign in'} <ArrowRight size={17} aria-hidden="true"/></button>
    <p className={'admin-login__message' + (status ? ' is-' + status.type : '')} role="status">{status?.text}</p>
    <div className="admin-login__security"><ShieldCheck size={15} aria-hidden="true"/><span>Sessions use HTTP-only cookies, CSRF protection, and server-enforced roles.</span></div>
  </form>;
}
