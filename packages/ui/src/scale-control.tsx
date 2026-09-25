'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export function createInclusiveScale(min: number, max: number): number[] {
    if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        (min !== 0 && min !== 1) ||
        max < min ||
        max > 10
    ) {
        throw new RangeError(
            'Scale must be an inclusive 0..N or 1..N range with N no greater than 10.',
        );
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
    readonly required?: boolean;
    readonly submitted?: boolean;
    readonly presentation?: 'score' | 'rating';
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
    const moves: Readonly<Record<string, number>> = {
        ArrowDown: Math.max(min, current - 1),
        ArrowLeft: Math.max(min, current - 1),
        ArrowRight: Math.min(max, current + 1),
        ArrowUp: Math.min(max, current + 1),
        End: max,
        Home: min,
    };
    return moves[key];
}

export function ScaleControl({
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
}: ScaleControlProps) {
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
            <fieldset className="pf-scale" data-submitted="true">
                <legend>{label}</legend>
                <div className="pf-scale__submitted">
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
        <fieldset className="pf-scale" disabled={disabled}>
            <legend>{label}</legend>
            <div
                aria-describedby={feedbackId}
                aria-invalid={constraintInvalid || undefined}
                aria-label={label}
                aria-readonly={readOnly || undefined}
                aria-required={constraintRequired || undefined}
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
                    className="pf-visually-hidden"
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
            <output aria-live="polite" className="pf-scale__value" id={feedbackId}>
                {scaleStatus}
            </output>
        </fieldset>
    );
}

export type ScoreControlProps = Omit<ScaleControlProps, 'presentation'>;
export function ScoreControl(props: ScoreControlProps) {
    return <ScaleControl {...props} presentation="score" />;
}

export type RatingControlProps = Omit<ScaleControlProps, 'max' | 'min' | 'presentation'>;
export function RatingControl(props: RatingControlProps) {
    return <ScaleControl {...props} max={10} min={1} presentation="rating" />;
}
