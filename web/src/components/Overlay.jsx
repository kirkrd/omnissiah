import React, { useEffect } from 'react';

export default function Overlay({ onClose, className = '', children, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`overlay ${className}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={onClose}>
      <div className="overlay-body" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
