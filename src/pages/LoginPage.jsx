import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Home,
  Image,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';

import Footer from '../components/Footer';

export default function LoginPage() {
  const [role, setRole] = useState('student'); // 'student' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setAuthSuccess(false);
  };

  const handleFillStudent = () => {
    setRole('student');
    setEmail('student@srishakthi.ac.in');
    setPassword('aiclub2025');
    setAuthSuccess(false);
  };

  const handleFillAdmin = () => {
    setRole('admin');
    setEmail('admin@aiclub.org');
    setPassword('coordinator#secure');
    setAuthSuccess(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setAuthSuccess(true);

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.65 },
        colors: role === 'student' ? ['#c9f24e', '#ffffff', '#863bff'] : ['#ff4a4a', '#c9f24e', '#ffd700']
      });
    }, 600);
  };

  return (
    <div className="login-page">
      <main className="wrap">
        <div className="login-box">
          <div className="breadcrumb mono">
            <Link to="/">
              <ArrowLeft size={14} /> HOME
            </Link>
            <span style={{ color: 'var(--faint)' }}>/</span>
            <span style={{ color: 'var(--muted)' }}>PORTAL AUTHENTICATION</span>
          </div>

          <p className="kicker">// SRI SHAKTHI AI CLUB PORTAL</p>
          <h1>
            PORTAL <span className="ol">LOGIN</span>
          </h1>
          <p className="sub">
            Sign in to manage projects, access club resources, and submit hackathon builds.
          </p>

          <div className="portal-card">
            <div className="role-tabs" role="tablist">
              <button
                className={`role-btn ${role === 'student' ? 'on' : ''}`}
                type="button"
                role="tab"
                aria-selected={role === 'student'}
                onClick={() => handleRoleChange('student')}
              >
                Student Member
              </button>
              <button
                className={`role-btn ${role === 'admin' ? 'on' : ''}`}
                type="button"
                role="tab"
                aria-selected={role === 'admin'}
                onClick={() => handleRoleChange('admin')}
              >
                Club Coordinator / Admin
              </button>
            </div>

            <div className="chips-row">
              <span className="chips-label">QUICK DEMO:</span>
              <button
                className="chip"
                type="button"
                onClick={handleFillStudent}
              >
                Student Demo
              </button>
              <button
                className="chip"
                type="button"
                onClick={handleFillAdmin}
              >
                Admin Demo
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="emailInput">COLLEGE EMAIL OR MEMBER ID</label>
                <div className="input-wrap">
                  <Mail size={17} />
                  <input
                    type="text"
                    id="emailInput"
                    placeholder={role === 'student' ? 'student@srishakthi.ac.in' : 'admin@aiclub.org'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="passInput">ACCESS KEY / PASSWORD</label>
                <div className="input-wrap">
                  <Lock size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="passInput"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    className="toggle-pw"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-extra">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />{' '}
                  Remember me
                </label>
                <Link to="/chat?q=How+can+I+get+access+or+join+the+AI+Club+portal%3F">
                  Need access help?
                </Link>
              </div>

              <button
                className="btn btn-pri submit-btn"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span>Verifying credentials…</span>
                    <Loader2 size={16} className="spin" />
                  </>
                ) : authSuccess ? (
                  <>
                    <span>Authenticated</span>
                    <CheckCircle2 size={16} />
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {authSuccess && (
              <div className="auth-banner">
                <h4>
                  <CheckCircle2 size={18} /> Access Granted (Demo Mode)
                </h4>
                <p>
                  {role === 'admin'
                    ? `Authenticated as Coordinator / Admin (${email}). You have full administrative privileges for the AI Club workspace.`
                    : `Authenticated as Student Member (${email}). Welcome back to the AI Club workspace!`}
                </p>
                <div className="banner-links">
                  <Link className="btn btn-gho btn-sm" to="/">
                    <Home size={14} /> Return to Home
                  </Link>
                  <Link className="btn btn-gho btn-sm" to="/gallery">
                    <Image size={14} /> View Gallery
                  </Link>
                  <Link className="btn btn-gho btn-sm" to="/chat">
                    <MessageSquare size={14} /> Open AI Chat
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
