"use client";

import {
  Menu as MantineMenu,
  Modal as MantineModal,
  Select as MantineSelect,
  type SelectProps as MantineSelectProps,
  Tabs as MantineTabs,
} from "@mantine/core";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ConstraintSelectProps
  extends Omit<MantineSelectProps<string>, "hiddenInputProps" | "onChange"> {
  readonly "data-state"?: string | undefined;
  readonly onChange?: (value: string | null) => void;
}

export function ConstraintSelect({
  "aria-invalid": ariaInvalid,
  disabled,
  error,
  onChange,
  required,
  value,
  ...props
}: ConstraintSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [constraintInvalid, setConstraintInvalid] = useState(false);
  const dataState = props["data-state"] ?? (constraintInvalid ? "error" : undefined);
  const invalid =
    constraintInvalid ||
    Boolean(error) ||
    (ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== "false");

  useEffect(() => {
    if (!required || disabled || value) {
      setConstraintInvalid(false);
    }
  }, [disabled, required, value]);

  return (
    <MantineSelect
      {...props}
      {...(dataState !== undefined ? { "data-state": dataState } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(invalid ? { error: true } : {})}
      {...(required
        ? {
            hiddenInputProps: {
              "aria-hidden": true,
              className: "pf-visually-hidden",
              onInvalid: (event) => {
                event.preventDefault();
                setConstraintInvalid(true);
                inputRef.current?.focus();
              },
              required: true,
              tabIndex: -1,
              type: "text",
            },
          }
        : {})}
      onChange={(nextValue) => {
        setConstraintInvalid(false);
        onChange?.(nextValue);
      }}
      ref={inputRef}
      {...(required !== undefined ? { required } : {})}
      {...(value !== undefined ? { value } : {})}
    />
  );
}

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
  const enabledIds = items.filter((item) => !item.disabled).map((item) => item.id);
  const firstEnabledId = enabledIds[0] ?? null;
  const initialValue = initialId && enabledIds.includes(initialId) ? initialId : firstEnabledId;
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const resolvedValue = selectedValue && enabledIds.includes(selectedValue) ? selectedValue : firstEnabledId;

  useEffect(() => {
    if (selectedValue !== resolvedValue) {
      setSelectedValue(resolvedValue);
    }
  }, [resolvedValue, selectedValue]);

  return (
    <MantineTabs
      activateTabWithKeyboard={false}
      classNames={{ list: "pf-tabs__list", panel: "pf-tabs__panel", root: "pf-tabs", tab: "pf-tabs__tab" }}
      keepMounted
      onChange={setSelectedValue}
      unstyled
      value={resolvedValue}
    >
      <MantineTabs.List aria-label={label}>
        {items.map((item) => (
          <MantineTabs.Tab disabled={item.disabled} key={item.id} value={item.id}>
            {item.label}
          </MantineTabs.Tab>
        ))}
      </MantineTabs.List>
      {items.map((item) => (
        <MantineTabs.Panel key={item.id} tabIndex={0} value={item.id}>
          {item.content}
        </MantineTabs.Panel>
      ))}
    </MantineTabs>
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
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    requestAnimationFrame(() => itemRefs.current[0]?.focus());
  }, [open]);

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  return (
    <div className="pf-menu" onBlur={closeWhenFocusLeaves} ref={containerRef}>
      <MantineMenu
        closeOnClickOutside
        closeOnEscape
        loop
        menuItemTabIndex={0}
        onChange={setOpen}
        opened={open}
        position="bottom-end"
        returnFocus
        trapFocus={false}
        transitionProps={{ duration: 0 }}
        unstyled
        withInitialFocusPlaceholder={false}
        withinPortal={false}
      >
        <MantineMenu.Target>
          <button className="pf-button pf-button--secondary pf-menu__trigger" type="button">
            {triggerLabel}
          </button>
        </MantineMenu.Target>
        <MantineMenu.Dropdown aria-label={menuLabel} className="pf-film-strip">
          {items.map((item, index) => (
            <MantineMenu.Item
              aria-current={item.current ? "page" : undefined}
              className="pf-film-strip__item"
              component="a"
              data-danger={item.danger || undefined}
              href={item.href}
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
            >
              {item.label}
            </MantineMenu.Item>
          ))}
        </MantineMenu.Dropdown>
      </MantineMenu>
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
  return (
    <MantineModal
      centered
      classNames={{
        body: "pf-dialog__body",
        close: "pf-dialog__close",
        content: tone === "danger" ? "pf-dialog pf-dialog--danger" : "pf-dialog",
        header: "pf-dialog__header",
        inner: "pf-dialog__inner",
        overlay: "pf-dialog__overlay",
        root: "pf-dialog__root",
        title: "pf-dialog__title",
      }}
      closeButtonProps={{ "aria-label": "Close dialog" }}
      closeOnClickOutside={dismissible}
      closeOnEscape={dismissible}
      onClose={onClose}
      opened={open}
      padding={0}
      returnFocus
      size="min(560px, calc(100vw - 32px))"
      title={title}
      transitionProps={{ duration: 200, transition: "fade-down" }}
      trapFocus
      unstyled
      withCloseButton={dismissible}
    >
      <div className="pf-dialog__content">{children}</div>
      {actions ? <div className="pf-dialog__actions">{actions}</div> : null}
    </MantineModal>
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
  const candidateValue = value ?? internalValue;
  const selectedValue = candidateValue !== undefined && values.includes(candidateValue) ? candidateValue : undefined;
  const activeValue = previewValue !== undefined && values.includes(previewValue) ? previewValue : selectedValue;
  const locked = disabled || readOnly || submitted;
  const controlRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    setInternalValue((current) => current !== undefined && values.includes(current) ? current : undefined);
    setPreviewValue((current) => current !== undefined && values.includes(current) ? current : undefined);
  }, [values]);

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
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setPreviewValue(undefined);
          }
        }}
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
