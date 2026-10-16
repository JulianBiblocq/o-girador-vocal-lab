/**
 * NumericDraftInput.tsx
 * Saisie numerique fluide avec draft non bloque pendant la frappe (< 80 lignes).
 * Selectionne au focus, valide et borne [min, max] au blur ou touche Enter.
 */
import React, { useState, useEffect } from 'react';

interface NumericDraftInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export const NumericDraftInput: React.FC<NumericDraftInputProps> = ({
  value,
  onChange,
  min = 30,
  max = 240,
  defaultValue,
  className,
  disabled,
  ...rest
}) => {
  const [draft, setDraft] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) setDraft(String(value));
  }, [value, isFocused]);

  const commitValue = () => {
    const parsed = parseInt(draft, 10);
    const fallback = defaultValue ?? value;
    const finalVal = isNaN(parsed) ? fallback : Math.max(min, Math.min(max, parsed));
    setDraft(String(finalVal));
    if (finalVal !== value) onChange(finalVal);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.currentTarget.select();
    rest.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    commitValue();
    rest.onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(String(value));
      setIsFocused(false);
      e.currentTarget.blur();
    }
    rest.onKeyDown?.(e);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      {...rest}
    />
  );
};
