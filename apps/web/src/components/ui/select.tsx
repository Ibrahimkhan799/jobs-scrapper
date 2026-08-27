'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string; label: string };

type SelectProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
};

export function Select({
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder = 'Select',
  className,
  disabled,
  'aria-label': ariaLabel,
}: SelectProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value : internal;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(0, options.findIndex((option) => option.value === current)),
  );
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === current);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
    setOpen(false);
    button.current?.focus();
  }

  function onButtonKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
      setActive(Math.max(0, options.findIndex((option) => option.value === current)));
    }
  }

  function onMenuKey(event: ReactKeyboardEvent<HTMLUListElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option) commit(option.value);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={cn('relative', className)}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 border border-border bg-card px-2.5 text-left text-sm text-foreground transition-[border-color,background-color] duration-150',
          open && 'border-ring',
          disabled && 'opacity-50',
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((next) => !next);
          setActive(Math.max(0, options.findIndex((option) => option.value === current)));
        }}
        onKeyDown={onButtonKey}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className={cn('shrink-0 opacity-70 transition-transform duration-150', open && 'rotate-180')}>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={menu}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto border border-border bg-card py-1 shadow-[0_8px_24px_-12px_rgba(28,30,28,0.35)]"
          onKeyDown={onMenuKey}
        >
          {options.map((option, index) => {
            const isSelected = option.value === current;
            return (
              <li
                key={`${option.value}-${index}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                data-active={index === active}
                className={cn(
                  'cursor-pointer px-2.5 py-1.5 text-sm',
                  index === active && 'bg-muted',
                  isSelected && 'text-score',
                )}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option.value)}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
