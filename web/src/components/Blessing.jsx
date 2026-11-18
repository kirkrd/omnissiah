import React, { useEffect, useMemo, useRef } from 'react';
import Overlay from './Overlay.jsx';
import Censer from './Censer.jsx';

const LINES = [
  'The incense is offered. The Machine Spirit stirs.',
  'Sacred unguents applied to the cogitator housing.',
  'The rune of warding is struck thrice. The spirit is appeased.',
  'Let no heresy corrupt the build. Let no test fail unseen.',
];

export default function Blessing({ onClose }) {
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => close.current(), 5200);
    return () => clearTimeout(t);
  }, []);
  return (
    <Overlay onClose={onClose} className="overlay-bless" label="Blessing">
      <div className="blessing">
        <Censer size={120} />
        <p className="blessing-line">{line}</p>
      </div>
    </Overlay>
  );
}
