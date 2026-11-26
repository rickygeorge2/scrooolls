'use client';
import { useState } from 'react';
import Link from 'next/link';
import InstallSheet from './InstallSheet';
import { Download, Logo } from './Icons';

const chips = [['Hope', '#FFD666'], ['Joy', '#FFAD7A'], ['Peace', '#9CC8EE'], ['Bible in a Year', '#A8D5B0'], ['Did You Know?', '#C9B8F0']];

export default function Landing() {
  const [sheet, setSheet] = useState(false);
  return (
    <main className="screen">
      <div className="row">
        <Logo />
        <div className="brand" style={{ fontSize: 26 }}>Scrooolls</div>
      </div>
      <div className="grow stack" style={{ justifyContent: 'center', gap: 18 }}>
        <h1 style={{ fontSize: 46, lineHeight: 1.02 }}>Scripture,<br />one swipe<br />at a time.</h1>
        <p className="lead" style={{ fontSize: 17 }}>Short Bible reads on hope, joy, peace and more, from contributors who love the Word. New stories every day.</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {chips.map(([n, c]) => <span key={n} className="pill" style={{ background: c, fontSize: 13, padding: '6px 12px' }}>{n}</span>)}
        </div>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <button className="btn" onClick={() => setSheet(true)}><Download /> Download the app</button>
        <Link className="btn outline" href="/login?mode=signup">Create an account</Link>
        <Link className="btn ghost" href="/login">I already have an account · Log in</Link>
      </div>
      {sheet && <InstallSheet onClose={() => setSheet(false)} />}
    </main>
  );
}
