'use client';

import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react';

import { createInclusiveScale } from './scale';
import styles from './ScaleControl.module.scss';

export interface IScaleControlProps {
    label: string;
    name: string;
    min?: 0 | 1;
    max: number;
    value?: number;
    defaultValue?: number;
    onChange?: (value: number) => void;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    submitted?: boolean;
    presentation?: 'score' | 'rating';
}

/** The candidate when it belongs to the scale; anything outside it counts as no selection. */
function inScale(values: readonly number[], candidate: number | undefined): number | undefined {
    return candidate !== undefined && values.includes(candidate) ? candidate : undefined;
}

/** Radio-group keys: arrows step within the scale, Home and End jump to its ends. */
function keyboardScaleValue(
    key: string,
    current: number,
    min: number,
    max: number,
): number | undefined {
    const moves: Record<string, number> = {
        ArrowDown: Math.max(min, current - 1),
        ArrowLeft: Math.max(min, current - 1),
        ArrowRight: Math.min(max, current + 1),
        ArrowUp: Math.min(max, current + 1),
        End: max,
        Home: min,
    };
    return moves[key];
}

export default function ScaleControl({
    defaultValue,
    disabled = false,
    label,
    max,
    min = 1,
    name,
    onChange,
    presentation = 'score',
    readOnly = false,
    required = false,
    submitted = false,
    value,
}: IScaleControlProps) {
    const values = useMemo(() => createInclusiveScale(min, max), [max, min]);
    const firstValue = values[0] ?? min;
    const initialValue = inScale(values, defaultValue);
    const [internalValue, setInternalValue] = useState<number | undefined>(initialValue);
    const [previewValue, setPreviewValue] = useState<number | undefined>();
    const selectedValue = inScale(values, value ?? internalValue);
    const activeValue = inScale(values, previewValue) ?? selectedValue;
    const locked = disabled || readOnly || submitted;
    const constraintRequired = required && !locked;
    const [constraintInvalid, setConstraintInvalid] = useState(false);
    const controlsRef = useRef(new Map<number, HTMLButtonElement>());
    const feedbackId = useId();

    // Values that fall outside a changed scale, and a satisfied constraint, reset during render.
    if (internalValue !== undefined && !values.includes(internalValue)) {
        setInternalValue(undefined);
    }
    if (previewValue !== undefined && !values.includes(previewValue)) {
        setPreviewValue(undefined);
    }
    if (constraintInvalid && (!constraintRequired || selectedValue !== undefined)) {
        setConstraintInvalid(false);
    }

    const selectionLabel =
        selectedValue === undefined ? 'Not selected' : `${selectedValue} of ${max}`;
    const scaleStatus = constraintInvalid ? `Select a ${presentation}.` : selectionLabel;

    if (submitted) {
        return (
            <fieldset className={styles.scale} data-submitted="true">
                <legend>{label}</legend>
                <div className={styles.scale__submitted}>
                    <span>Submitted</span>
                    <strong>{selectionLabel}</strong>
                </div>
            </fieldset>
        );
    }

    function select(nextValue: number): void {
        if (locked) {
            return;
        }
        if (value === undefined) {
            setInternalValue(nextValue);
        }
        setConstraintInvalid(false);
        onChange?.(nextValue);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentValue: number): void {
        const nextValue = keyboardScaleValue(event.key, currentValue, min, max);
        if (nextValue !== undefined) {
            event.preventDefault();
            select(nextValue);
            controlsRef.current.get(nextValue)?.focus();
        }
    }

    return (
        <fieldset className={styles.scale} disabled={disabled}>
            <legend>{label}</legend>
            {/* eslint-disable-next-line jsx-a11y-x/interactive-supports-focus -- a radiogroup moves focus between its radios (roving tabindex); the group itself takes none. */}
            <div
                aria-describedby={feedbackId}
                aria-invalid={constraintInvalid || undefined}
                aria-label={label}
                aria-readonly={readOnly || undefined}
                aria-required={constraintRequired || undefined}
                className={styles.scale__rail}
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
                            className={styles.scale__option}
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
                                    controlsRef.current.set(scaleValue, node);
                                } else {
                                    controlsRef.current.delete(scaleValue);
                                }
                            }}
                            role="radio"
                            tabIndex={
                                selected ||
                                (selectedValue === undefined && scaleValue === firstValue)
                                    ? 0
                                    : -1
                            }
                            type="button"
                        >
                            {presentation === 'rating' ? (
                                <span aria-hidden="true">★</span>
                            ) : (
                                scaleValue
                            )}
                        </button>
                    );
                })}
            </div>
            <input name={name} type="hidden" value={selectedValue ?? ''} />
            {constraintRequired ? (
                <input
                    aria-hidden="true"
                    className="visually-hidden"
                    data-scale-constraint
                    onChange={() => undefined}
                    onInvalid={(event) => {
                        event.preventDefault();
                        setConstraintInvalid(true);
                        controlsRef.current.get(firstValue)?.focus();
                    }}
                    required
                    tabIndex={-1}
                    type="text"
                    value={selectedValue ?? ''}
                />
            ) : null}
            <output aria-live="polite" className={styles.scale__value} id={feedbackId}>
                {scaleStatus}
            </output>
        </fieldset>
    );
}
