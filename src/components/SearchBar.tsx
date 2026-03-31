"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Rechercher une formation, une compétence, une école...",
  debounceMs = 300,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when value changes externally (e.g. reset)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(val);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-text-muted"
        >
          <path
            d="M7.25 1.5a5.75 5.75 0 1 0 3.58 10.27l2.72 2.73a.75.75 0 1 0 1.06-1.06l-2.73-2.72A5.75 5.75 0 0 0 7.25 1.5ZM3 7.25a4.25 4.25 0 1 1 8.5 0 4.25 4.25 0 0 1-8.5 0Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-white py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30 transition-colors"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue("");
            onChange("");
          }}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-secondary"
          aria-label="Effacer la recherche"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
