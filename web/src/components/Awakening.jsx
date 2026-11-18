import React, { useEffect, useRef, useState } from 'react';
import Seal from './Seal.jsx';

const BOOT = [
  'MOTIVE FORCE ........ NOMINAL',
  'NOOSPHERIC LINK ..... ESTABLISHED',
  'MACHINE SPIRITS ..... STIRRING',
  'LITANIES LOADED ..... 0x4F4D4E49',
];

/** First-load rite: boot litany, the seal ignites, then the forge opens. Click to skip. */
export default function Awakening({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setLeaving(true), reduced ? 200 : 2300);
    const t2 = setTimeout(() => done.current(), reduced ? 400 : 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return (
    <div className={`awakening ${leaving ? 'leaving' : ''}`} onClick={onDone} role="presentation">
      <Seal size={180} className="awakening-seal" active />
      <div className="awakening-title">O M N I S S I A H</div>
      <div className="awakening-boot">
        {BOOT.map((l, i) => (
          <div key={l} style={{ animationDelay: `${0.3 + i * 0.28}s` }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
