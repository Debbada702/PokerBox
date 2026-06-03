import { useState } from 'react';
import './AuthScreen.css';

export default function AuthScreen({
  onLogin,
  onGoogleLogin,
  onRegister,
  loading,
  error,
  setError,
}) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nametag, setNametag] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setError?.(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === 'login') {
      onLogin({ email, password });
    } else {
      onRegister({ email, password, nametag });
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-screen__card">
        <div className="auth-screen__brand">
          <span className="auth-screen__logo">♠</span>
          <h1>PokerBox</h1>
          <p>Accedi o crea account per giocare</p>
        </div>

        <div className="auth-screen__tabs">
          <button
            type="button"
            className={mode === 'login' ? 'auth-screen__tab auth-screen__tab--active' : 'auth-screen__tab'}
            onClick={() => switchMode('login')}
          >
            Accedi
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'auth-screen__tab auth-screen__tab--active' : 'auth-screen__tab'}
            onClick={() => switchMode('register')}
          >
            Registrati
          </button>
        </div>

        <form className="auth-screen__form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="auth-screen__field">
              <span>Nametag</span>
              <input
                type="text"
                value={nametag}
                onChange={(event) => setNametag(event.target.value)}
                placeholder="Es. PokerKing99"
                autoComplete="username"
                maxLength={20}
                required
              />
            </label>
          )}

          <label className="auth-screen__field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tua@email.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-screen__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          {error && <p className="auth-screen__error" role="alert">{error}</p>}

          <button type="submit" className="auth-screen__submit" disabled={loading}>
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Crea account'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="auth-screen__google-wrap">
            <div className="auth-screen__separator">
              <span>oppure</span>
            </div>
            <button
              type="button"
              className="auth-screen__google-oauth"
              onClick={() => onGoogleLogin?.()}
              disabled={loading}
            >
              Continua con Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
