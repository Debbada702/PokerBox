import { useMemo, useState } from 'react';
import './AppPages.css';

function makeVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function PageShell({ title, eyebrow, children, onBack, actions = null }) {
  return (
    <div className="page-shell">
      <header className="page-shell__header">
        {onBack ? (
          <button type="button" className="page-shell__back" onClick={onBack}>← Indietro</button>
        ) : <span />}
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {actions}
      </header>
      <main className="page-shell__body">{children}</main>
    </div>
  );
}

export function ProfilePage({ user, loading, onUpdateAccount, onBack }) {
  const [nametag, setNametag] = useState(user?.nametag ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [message, setMessage] = useState(null);

  const changed = useMemo(() => (
    nametag.trim() !== (user?.nametag ?? '') ||
    email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase() ||
    password.trim().length > 0
  ), [email, nametag, password, user]);

  const resetCode = () => {
    setPendingCode('');
    setCodeInput('');
  };

  const sendCode = () => {
    if (!changed) {
      setMessage({ type: 'error', text: 'Modifica almeno un campo prima di richiedere il codice.' });
      return;
    }
    const code = makeVerificationCode();
    setPendingCode(code);
    setMessage({ type: 'success', text: `Codice di verifica inviato a ${user?.email}.` });
    console.info('[PokerBox] codice verifica account:', code);
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!pendingCode || codeInput.trim() !== pendingCode) {
      setMessage({ type: 'error', text: 'Inserisci il codice ricevuto via email per salvare.' });
      return;
    }
    const result = await onUpdateAccount({ nametag, email, password });
    if (result.ok) {
      setPassword('');
      resetCode();
      setMessage({ type: 'success', text: 'Profilo aggiornato.' });
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Aggiornamento fallito.' });
    }
  };

  return (
    <PageShell title="Profilo" eyebrow="Account" onBack={onBack}>
      <form className="page-card page-form" onSubmit={submit}>
        <label>
          <span>Nametag</span>
          <input value={nametag} minLength={3} maxLength={20} onChange={(event) => { setNametag(event.target.value); resetCode(); }} required />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); resetCode(); }} required />
        </label>
        <label>
          <span>Nuova password</span>
          <input type="password" value={password} minLength={6} placeholder="Lascia vuoto per non cambiare" onChange={(event) => { setPassword(event.target.value); resetCode(); }} />
        </label>
        <div className="page-form__verify">
          <button type="button" onClick={sendCode} disabled={!changed}>Invia codice</button>
          <input value={codeInput} inputMode="numeric" maxLength={6} placeholder="Codice email" onChange={(event) => setCodeInput(event.target.value)} />
        </div>
        {message && <p className={`page-message page-message--${message.type}`}>{message.text}</p>}
        <button type="submit" className="page-primary" disabled={loading || !changed}>{loading ? 'Salvo...' : 'Salva modifiche'}</button>
      </form>
    </PageShell>
  );
}

export function WalletPage({ wallet, onBack }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(null);

  const convert = async () => {
    const result = await wallet.convertToChips(amount, (chips) => wallet.onChipsAdded?.(chips));
    if (result.ok) {
      setMessage({ type: 'success', text: `Convertiti ${result.bottiSpent} BOTTI in ${result.chips} chips.` });
      setAmount('');
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  return (
    <PageShell title="Wallet BottiCoin" eyebrow="Saldo e conversioni" onBack={onBack}>
      <section className="page-card page-stack">
        {!wallet.connected ? (
          <button type="button" className="page-primary" onClick={wallet.connectWallet}>Collega wallet</button>
        ) : (
          <>
            <p className="page-mono">{wallet.address?.slice(0, 10)}...{wallet.address?.slice(-8)}</p>
            <div className="page-stat">
              <span>Saldo disponibile</span>
              <strong>{wallet.bottiBalance} BOTTI</strong>
            </div>
            <p className="page-note">1 BottiCoin = {wallet.chipsPerBotti} chips</p>
            <input type="number" min="1" max={wallet.bottiBalance} value={amount} placeholder="Quanti BottiCoin?" onChange={(event) => setAmount(event.target.value)} />
            <button type="button" className="page-primary" onClick={convert}>Converti in chips</button>
            {message && <p className={`page-message page-message--${message.type}`}>{message.text}</p>}
            <button type="button" className="page-secondary" onClick={wallet.disconnectWallet}>Scollega wallet</button>
          </>
        )}
      </section>
    </PageShell>
  );
}

export function TermsPage({ onBack, onAccept, mustAccept = false }) {
  return (
    <PageShell title="Termini e condizioni" eyebrow="PokerBox" onBack={mustAccept ? undefined : onBack}>
      <section className="page-card page-terms">
        <h2>Uso del servizio</h2>
        <p>PokerBox è un'applicazione di intrattenimento. Le chips sono unità di gioco interne e non rappresentano denaro reale o valore finanziario garantito.</p>
        <h2>Account e sicurezza</h2>
        <p>Ogni utente è responsabile delle credenziali, dell'attività svolta dal proprio account e del rispetto degli altri giocatori nelle stanze.</p>
        <h2>Partite e saldo</h2>
        <p>Le partite rapide contro bot sono pratica; le stanze reali possono aggiornare il saldo chips secondo le regole del tavolo.</p>
        <h2>Condotta</h2>
        <p>Non sono consentiti abuso della chat, tentativi di manipolazione, automazioni scorrette o uso del servizio per scopi illeciti.</p>
        <label className="page-accept">
          <input id="terms-accept-check" type="checkbox" />
          <span>Ho letto e accetto i termini e condizioni.</span>
        </label>
        {onAccept && (
          <button
            type="button"
            className="page-primary"
            onClick={() => {
              if (document.getElementById('terms-accept-check')?.checked) onAccept();
            }}
          >
            Accetta e continua
          </button>
        )}
      </section>
    </PageShell>
  );
}

export function InfoPage({ type, onBack }) {
  const content = {
    security: {
      title: 'Sicurezza account',
      eyebrow: 'Protezione',
      body: ['Usa una password unica e non condividere il tuo account.', 'Le modifiche profilo richiedono un codice di verifica.', 'Se noti attività sospette, esci dall account e cambia password.'],
    },
    support: {
      title: 'Supporto',
      eyebrow: 'Assistenza',
      body: ['Controlla configurazione Supabase, OAuth e Render se login o deploy non rispondono.', 'Per problemi al tavolo, segnati codice stanza e numero mano.', 'La sezione supporto potrà essere collegata a ticket o email quando aggiungerai un servizio dedicato.'],
    },
  }[type];

  return (
    <PageShell title={content.title} eyebrow={content.eyebrow} onBack={onBack}>
      <section className="page-card page-stack">
        {content.body.map((line) => <p key={line}>{line}</p>)}
      </section>
    </PageShell>
  );
}
