import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import './PortalAuth.css';

export function PortalLoginLayout({ eyebrow, title, story, backLabel, backTo, children }) {
  return <main className="admin-login">
    <section className="admin-login__visual" aria-label={eyebrow}>
      <div className="admin-login__visual-grid" aria-hidden="true" />
      <Link to="/" className="admin-brand" aria-label="AI Club home">
        <span className="admin-brand__emblem"><img src="/ai-club-new-logo.png" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/ai-club-emblem.png'; }} alt=""/></span>
        <span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span>
      </Link>
      <div className="admin-login__illustration" aria-hidden="true">
        <span className="admin-login__orbit admin-login__orbit--one"/>
        <span className="admin-login__orbit admin-login__orbit--two"/>
        <span className="admin-login__orbit admin-login__orbit--three"/>
        <span className="admin-login__satellite admin-login__satellite--one"/>
        <span className="admin-login__satellite admin-login__satellite--two"/>
        <span className="admin-login__satellite admin-login__satellite--three"/>
        <span className="admin-login__core"><span className="admin-login__core-shimmer"/><Sparkles size={35} strokeWidth={1.5}/><span>AI</span></span>
      </div>
      <div className="admin-login__story">
        <span className="admin-login__eyebrow"><span className="admin-login__eyebrow-line"/> {eyebrow}</span>
        <h2>{title}</h2>
        <p>{story}</p>
        <div className="admin-login__trust">
          <span><ShieldCheck size={17} aria-hidden="true"/> Private member workspace</span>
          <span><Zap size={17} aria-hidden="true"/> One club. Endless possibilities.</span>
        </div>
      </div>
      <footer><span className="admin-login__footer-dot"/> ENGINEERED FOR CREATORS <span className="admin-login__footer-line"/> SRI SHAKTHI</footer>
    </section>
    <section className="admin-login__form-side">
      <div className="admin-login__form-top"><Link to={backTo} className="admin-login__back"><ArrowLeft size={16}/> {backLabel}</Link><span className="admin-login__form-top-tag"><span/> MEMBER PORTAL</span></div>
      <div className="admin-login__card">{children}</div>
      <div className="admin-login__help"><LockKeyhole size={14} aria-hidden="true"/> Your account, protected by secure sign-in.</div>
    </section>
  </main>;
}

export function LoginForm({ identifier, setIdentifier, password, setPassword, remember, setRemember, showPassword, setShowPassword, status, setStatus, submitting, handleSubmit }) {
  return <form onSubmit={handleSubmit}>
    <label htmlFor="portal-identifier">Member ID or email address</label>
    <div className="admin-field"><input id="portal-identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={160} placeholder="Enter your member or admin ID" value={identifier} onChange={event => { setIdentifier(event.target.value); setStatus(null); }} required/></div>
    <div className="admin-password-row"><label htmlFor="portal-password">Password</label></div>
    <div className="admin-field"><input id="portal-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => { setPassword(event.target.value); setStatus(null); }} required minLength={8} maxLength={200}/><button type="button" className="admin-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="portal-password">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
    <label className="admin-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)}/><span>Keep me signed in on this device</span></label>
    <button type="submit" className="admin-login__submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Enter the Club'} <ArrowRight size={18} aria-hidden="true"/></button>
    <p className={'admin-login__message' + (status ? ' is-' + status.type : '')} role="status">{status?.text}</p>
    <div className="admin-login__security"><ShieldCheck size={16} aria-hidden="true"/><span>Encrypted sessions and protected access for every member.</span></div>
  </form>;
}
