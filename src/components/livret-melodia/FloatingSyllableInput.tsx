/**
 * FloatingSyllableInput.tsx
 * Champ de saisie direct sur une brique de note avec navigation Tab / Entrée.
 * Style Cordel : rounded-none, bordure franche.
 */
import React, { useState, useEffect, useRef } from 'react';

interface FloatingSyllableInputProps {
  initialText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onConfirm: (text: string, jumpNext: boolean) => void;
  onCancel: () => void;
}

export const FloatingSyllableInput: React.FC<FloatingSyllableInputProps> = (props) => {
  const { initialText, x, y, width, height, onConfirm, onCancel } = props;
  const [text, setText] = useState<string>(initialText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(initialText);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [initialText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      onConfirm(text, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onConfirm(text, false)}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${Math.max(60, width)}px`,
        height: `${height}px`,
      }}
      placeholder="Syllabe..."
      className="absolute z-30 px-1 py-0 bg-stone-900 border-2 border-theme-accent rounded-none text-theme-ink font-mono text-[11px] font-bold text-center shadow-xl outline-none"
    />
  );
};
