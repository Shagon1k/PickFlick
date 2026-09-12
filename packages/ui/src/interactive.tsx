"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly label: string;
  readonly initialId?: string;
}

export function Tabs({ initialId, items, label }: TabsProps) {
  const prefix = useId();
  const enabledIds = useMemo(() => items.filter((item) => !item.disabled).map((item) => item.id), [items]);
  const [selectedId, setSelectedId] = useState(
    initialId && enabledIds.includes(initialId) ? initialId : (enabledIds[0] ?? ""),
  );
  const activeId = enabledIds.includes(selectedId) ? selectedId : (enabledIds[0] ?? "");
  const tabsRef = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (selectedId !== activeId) {
      setSelectedId(activeId);
    }
  }, [activeId, selectedId]);

  function focusRelative(currentId: string, direction: -1 | 1): void {
    const currentIndex = enabledIds.indexOf(currentId);
    const nextId = enabledIds[(currentIndex + direction + enabledIds.length) % enabledIds.length];
    if (nextId) {
      tabsRef.current.get(nextId)?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string): void {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusRelative(id, -1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusRelative(id, 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const destinationId = event.key === "Home" ? enabledIds[0] : enabledIds.at(-1);
      if (destinationId) {
        tabsRef.current.get(destinationId)?.focus();
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId(id);
    }
  }

  return (
    <div className="pf-tabs">
      <div aria-label={label} className="pf-tabs__list" role="tablist">
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              aria-controls={`${prefix}-${item.id}-panel`}
              aria-selected={selected}
              className="pf-tabs__tab"
              disabled={item.disabled}
              id={`${prefix}-${item.id}-tab`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              onKeyDown={(event) => handleKeyDown(event, item.id)}
              ref={(node) => {
                if (node) {
                  tabsRef.current.set(item.id, node);
                } else {
                  tabsRef.current.delete(item.id);
                }
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          aria-labelledby={`${prefix}-${item.id}-tab`}
          className="pf-tabs__panel"
          hidden={item.id !== activeId}
          id={`${prefix}-${item.id}-panel`}
          key={item.id}
          role="tabpanel"
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

export interface FilmStripMenuItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly current?: boolean;
  readonly danger?: boolean;
}

export interface FilmStripMenuProps {
  readonly triggerLabel: string;
  readonly menuLabel: string;
  readonly items: readonly FilmStripMenuItem[];
}

export function FilmStripMenu({ items, menuLabel, triggerLabel }: FilmStripMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    itemRefs.current[0]?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function closeAndRestoreFocus(): void {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      itemRefs.current[(currentIndex + direction + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? itemRefs.current[0] : itemRefs.current.at(-1))?.focus();
    }
  }

  return (
    <div className="pf-menu" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="pf-button pf-button--secondary pf-menu__trigger"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {triggerLabel}
      </button>
      {open ? (
        <div aria-label={menuLabel} className="pf-film-strip" onKeyDown={handleMenuKeyDown} role="menu">
          {items.map((item, index) => (
            <a
              aria-current={item.current ? "page" : undefined}
              className="pf-film-strip__item"
              data-danger={item.danger || undefined}
              href={item.href}
              key={item.id}
              onClick={closeAndRestoreFocus}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="menuitem"
              tabIndex={-1}
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly onClose: () => void;
  readonly dismissible?: boolean;
  readonly tone?: "neutral" | "danger";
}

export function Dialog({ actions, children, dismissible = true, onClose, open, title, tone = "neutral" }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="pf-dialog"
      data-tone={tone}
      onCancel={(event) => {
        if (!dismissible) {
          event.preventDefault();
        }
      }}
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
      ref={dialogRef}
    >
      <div className="pf-dialog__body">
        <div className="pf-dialog__header">
          <h2 id={titleId}>{title}</h2>
          {dismissible ? (
            <button
              aria-label="Close dialog"
              className="pf-dialog__close"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
        <div className="pf-dialog__content">{children}</div>
        {actions ? <div className="pf-dialog__actions">{actions}</div> : null}
      </div>
    </dialog>
  );
}

export function createInclusiveScale(min: number, max: number): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || (min !== 0 && min !== 1) || max < min || max > 10) {
    throw new RangeError("Scale must be an inclusive 0..N or 1..N range with N no greater than 10.");
  }
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

export interface ScaleControlProps {
  readonly label: string;
  readonly name: string;
  readonly min?: 0 | 1;
  readonly max: number;
  readonly value?: number;
  readonly defaultValue?: number;
  readonly onChange?: (value: number) => void;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly submitted?: boolean;
  readonly presentation?: "score" | "rating";
}

export function ScaleControl({
  defaultValue,
  disabled = false,
  label,
  max,
  min = 1,
  name,
  onChange,
  presentation = "score",
  readOnly = false,
  submitted = false,
  value,
}: ScaleControlProps) {
  const values = useMemo(() => createInclusiveScale(min, max), [max, min]);
  const firstValue = values[0] ?? min;
  const initialValue = defaultValue !== undefined && values.includes(defaultValue) ? defaultValue : undefined;
  const [internalValue, setInternalValue] = useState<number | undefined>(initialValue);
  const [previewValue, setPreviewValue] = useState<number | undefined>();
  const selectedValue = value ?? internalValue;
  const activeValue = previewValue ?? selectedValue;
  const locked = disabled || readOnly || submitted;
  const controlRefs = useRef(new Map<number, HTMLButtonElement>());

  function select(nextValue: number): void {
    if (locked) {
      return;
    }
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentValue: number): void {
    let nextValue: number | undefined;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = Math.max(min, currentValue - 1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = Math.min(max, currentValue + 1);
    } else if (event.key === "Home") {
      nextValue = min;
    } else if (event.key === "End") {
      nextValue = max;
    }
    if (nextValue !== undefined) {
      event.preventDefault();
      select(nextValue);
      controlRefs.current.get(nextValue)?.focus();
    }
  }

  return (
    <fieldset className="pf-scale" disabled={disabled}>
      <legend>{label}</legend>
      <div
        aria-label={label}
        aria-readonly={readOnly || submitted || undefined}
        className="pf-scale__rail"
        data-presentation={presentation}
        onMouseLeave={() => setPreviewValue(undefined)}
        role="radiogroup"
      >
        {values.map((scaleValue) => {
          const selected = scaleValue === selectedValue;
          const active = activeValue !== undefined && scaleValue <= activeValue;
          return (
            <button
              aria-checked={selected}
              aria-label={`${scaleValue} of ${max}`}
              className="pf-scale__option"
              data-active={active || undefined}
              data-selected={selected || undefined}
              disabled={disabled}
              key={scaleValue}
              onClick={() => select(scaleValue)}
              onFocus={() => {
                if (!locked) {
                  setPreviewValue(scaleValue);
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, scaleValue)}
              onMouseEnter={() => {
                if (!locked) {
                  setPreviewValue(scaleValue);
                }
              }}
              ref={(node) => {
                if (node) {
                  controlRefs.current.set(scaleValue, node);
                } else {
                  controlRefs.current.delete(scaleValue);
                }
              }}
              role="radio"
              tabIndex={selected || (selectedValue === undefined && scaleValue === firstValue) ? 0 : -1}
              type="button"
            >
              {presentation === "rating" ? <span aria-hidden="true">★</span> : scaleValue}
            </button>
          );
        })}
      </div>
      <input name={name} type="hidden" value={selectedValue ?? ""} />
      <output aria-live="polite" className="pf-scale__value">
        {selectedValue === undefined ? "Not selected" : `${selectedValue} of ${max}`}
      </output>
    </fieldset>
  );
}

export type ScoreControlProps = Omit<ScaleControlProps, "presentation">;
export function ScoreControl(props: ScoreControlProps) {
  return <ScaleControl {...props} presentation="score" />;
}

export type RatingControlProps = Omit<ScaleControlProps, "max" | "min" | "presentation">;
export function RatingControl(props: RatingControlProps) {
  return <ScaleControl {...props} max={10} min={1} presentation="rating" />;
}
