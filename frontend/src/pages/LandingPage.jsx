import React from 'react';
import LoginForm from '../components/auth/LoginForm';
import '../styles/LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <header className="landing-page__nav">
        <div className="landing-page__nav-brand">ChatApp</div>
        <button
          type="button"
          className="landing-page__nav-login"
          onClick={() => {
            document.getElementById('landing-login')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Login
        </button>
      </header>

      <div className="landing-page__content">
        <div className="landing-page__hero">
          <div className="landing-page__brand">ChatApp</div>
          <h1>Connect instantly with video rooms</h1>
          <p>
            Host secure video conferences, invite your team, and collaborate in real time.
            Create private rooms with passwords and manage participants easily.
          </p>
          <ul>
            <li>Private rooms with passwords</li>
            <li>High-quality audio & video</li>
            <li>Fast and secure sign-in</li>
          </ul>
        </div>

        <div className="landing-page__card" id="landing-login">
          <LoginForm />
        </div>
      </div>

      <footer className="landing-page__footer">
        <span>© 2026 ChatApp</span>
        <div className="landing-page__footer-links">
          <a href="mailto:akililuabera44@gmail.com">akililuabera44@gmail.com</a>
          <a href="https://personal-portfolio-three-omega-52.vercel.app/" target="_blank" rel="noreferrer">
            Portfolio
          </a>
          <a href="https://github.com/AkesTechSE" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://www.upwork.com/freelancers/~01ef05b09a4e009492?mp_source=share&mp_medium=copy_link" target="_blank" rel="noreferrer">
            Upwork
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
