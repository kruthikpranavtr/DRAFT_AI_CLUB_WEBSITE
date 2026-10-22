import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../components/PortalAuth.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function submit(event) {
    event.preventDefault();
    setSent(true);
  }

  return <main className="admin-login">
    <section className="admin-login__visual" aria-label="Account recovery">
      <div className="admin-login__ambient" aria-hidden="true"><span className="admin-node admin-node--one"/><span className="admin-node admin-node--two"/><span className="admin-node admin-node--three"/><i className="admin-orbit admin-orbit--one"/><i className="admin-orbit admin-orbit--two"/></div>
      <Link to="/" className="admin-brand"><img src="/ai-club-new-logo.png" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/ai-club-emblem.png"; }} alt=""/><span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span></Link>
      <div className="admin-login__story">
        <div className="admin-login__eyebrow"><Sparkles size={14}/> ACCOUNT RECOVERY</div>
        <h1>Find your way<br/><em>back to the network.</em></h1>
        <p>Use the email connected to your student or administrator account. The production system will send a secure, time-limited recovery link.</p>
        <div className="admin-login__trust"><span><ShieldCheck size={17}/> Secure recovery flow</span></div>
      </div>
      <footer>AI CLUB MEMBER SYSTEM <span/> RECOVERY</footer>
    </section>

    <section className="admin-login__form-side">
      <Link to="/login" className="admin-login__back"><ArrowLeft size={16}/> Back to sign in</Link>
      <div className="admin-login__card">
        <div className="admin-login__card-icon">{sent ? <CheckCircle2 size={25}/> : <Mail size={24}/>}</div>
        <div className="admin-login__label-row"><span className="admin-login__label">RECOVER ACCESS</span><span className="admin-demo-badge">DEMO FLOW</span></div>
        <h2>{sent ? 'Check your inbox.' : 'Reset password.'}</h2>
        <p className="admin-login__intro">{sent ? 'A simulated recovery link has been sent to ' + email + '.' : 'Enter the email used for your AI Club account.'}</p>
        {!sent ? <form onSubmit={submit}>
          <label htmlFor="recovery-email">Account email address</label>
          <div className="admin-field"><Mail size={18}/><input id="recovery-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@srishakthi.ac.in" required/></div>
          <button type="submit" className="admin-login__submit" style={{marginTop:24}}>Send recovery link <ArrowRight size={17}/></button>
        </form> : <Link to="/login" className="admin-login__submit">Return to sign in <ArrowRight size={17}/></Link>}
        <div className="admin-login__security"><ShieldCheck size={15}/><span>This is a frontend demonstration. No email is sent until a backend email service is connected.</span></div>
      </div>
    </section>
  </main>;
}
