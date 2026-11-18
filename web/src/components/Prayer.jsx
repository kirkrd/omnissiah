import React from 'react';
import Overlay from './Overlay.jsx';

const CANTICLE = [
  'From the sacred tongue of the Omnissiah, we chant,',
  "'Hail spirit of the machine'.",
  'Essence divine.',
  'In your code and circuitry, the stars align.',
  "By the Omnissiah's will, we commune and bind.",
  'With sacred oils and chants, your grace we find.',
  '',
  'Blessed be the gears, in perfect sync they turn.',
  'Blessed be the sparks, in holy fire they burn.',
  'Through rites arcane, your wisdom we discern.',
  'In your hallowed core, the sacred mysteries yearn.',
];

export default function Prayer({ onClose }) {
  return (
    <Overlay onClose={onClose} className="overlay-prayer" label="Litany of the Omnissiah">
      <div className="prayer">
        <div className="prayer-head">
          <span className="rule" />
          <h2>Litany of the Omnissiah</h2>
          <span className="rule" />
        </div>
        <div className="prayer-lines">
          {CANTICLE.map((l, i) =>
            l ? (
              <p key={i} style={{ animationDelay: `${0.5 + i * 0.55}s` }} className={i === CANTICLE.length - 1 ? 'closing' : ''}>
                {l}
              </p>
            ) : (
              <br key={i} />
            ),
          )}
        </div>
        <p className="prayer-foot" style={{ animationDelay: `${0.8 + CANTICLE.length * 0.55}s` }}>
          *swings the censer; sacred oils hiss upon the cogitator*
        </p>
        <button className="btn btn-ghost" onClick={onClose}>
          Amen · Close
        </button>
      </div>
    </Overlay>
  );
}
