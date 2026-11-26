'use client';
import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '@/lib/pushClient';

let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
}

export default function InstallSheet({ onClose }) {
  const [os, setOs] = useState('android');
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setOs(isIOS() ? 'ios' : 'android');
    setCanPrompt(Boolean(deferredPrompt));
    setInstalled(isStandalone());
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanPrompt(false);
    if (choice.outcome === 'accepted') setInstalled(true);
  }

  const steps = os === 'ios'
    ? ['Open this page in Safari.', 'Tap the Share button (the square with an arrow).', 'Scroll down and choose “Add to Home Screen”, then tap Add.', 'Open Scrooolls from your home screen and sign in. On iPhone, notifications only work after this step.']
    : canPrompt
      ? ['Tap “Install Scrooolls” below.', 'Confirm when your phone asks.', 'Open Scrooolls from your home screen.']
      : ['Open this page in Chrome.', 'Tap the ⋮ menu at the top right.', 'Choose “Install app” or “Add to Home screen”.', 'Open Scrooolls from your home screen.'];

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add Scrooolls to your phone" onClick={(e) => e.stopPropagation()}>
        <h2 className="title" style={{ fontSize: 28 }}>Add Scrooolls to your phone</h2>
        <p className="lead">No app store needed. Scrooolls installs from this website and opens full-screen like any other app.</p>
        {installed ? (
          <p className="card">Scrooolls is already installed on this device.</p>
        ) : (
          <>
            <div className="seg">
              <button className={os === 'android' ? 'on' : ''} onClick={() => setOs('android')}>Android</button>
              <button className={os === 'ios' ? 'on' : ''} onClick={() => setOs('ios')}>iPhone</button>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {steps.map((s, i) => (
                <div key={i} className="card row" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <div className="num">{i + 1}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.45, paddingTop: 4 }}>{s}</div>
                </div>
              ))}
            </div>
            {os === 'android' && canPrompt && <button className="btn" onClick={install}>Install Scrooolls</button>}
          </>
        )}
        <button className="btn outline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
