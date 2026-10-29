'use client';

import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react';

import { createInclusiveScale } from './scale';
import styles from './ScaleControl.module.scss';

export interface IScaleControlProps {
    label: string;
    isCompact?: boolean;
    name: string;
    min?: 0 | 1;
    max: number;
    value?: number;
    defaultValue?: number;
    onChange?: (value: number) => void;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    isSubmitted?: boolean;
    presentation?: 'score' | 'rating';
}

/** The candidate when it belongs to the scale; anything outside it counts as no selection. */
function findScaleValue(
    values: readonly number[],
    candidate: number | undefined,
): number | undefined {
    return candidate !== undefined && values.includes(candidate) ? candidate : undefined;
}

/** Rating stars fill up to the value; a score marks only the chosen option. */
function isFilled(
    presentation: IScaleControlProps['presentation'],
    scaleValue: number,
    target: number | undefined,
): boolean {
    return presentation === 'rating' && target !== undefined && scaleValue <= target;
}

/** Radio-group keys: arrows step within the scale, Home and End jump to its ends. */
function getKeyboardScaleValue(
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
    isCompact = false,
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
    isSubmitted = false,
    value,
}: IScaleControlProps) {
    const values = useMemo(() => createInclusiveScale(min, max), [max, min]);
    const firstValue = values[0] ?? min;
    const initialValue = findScaleValue(values, defaultValue);
    const [internalValue, setInternalValue] = useState<number | undefined>(initialValue);
    const [previewValue, setPreviewValue] = useState<number | undefined>();
    const selectedValue = findScaleValue(values, value ?? internalValue);
    const activeValue = findScaleValue(values, previewValue) ?? selectedValue;
    const isLocked = disabled || readOnly || isSubmitted;
    const isConstraintRequired = required && !isLocked;
    const [isConstraintInvalid, setIsConstraintInvalid] = useState(false);
    const controlsRef = useRef(new Map<number, HTMLButtonElement>());
    const feedbackId = useId();

    // Values that fall outside a changed scale, and a satisfied constraint, reset during render.
    if (internalValue !== undefined && !values.includes(internalValue)) {
        setInternalValue(undefined);
    }
    if (previewValue !== undefined && !values.includes(previewValue)) {
        setPreviewValue(undefined);
    }
    if (isConstraintInvalid && (!isConstraintRequired || selectedValue !== undefined)) {
        setIsConstraintInvalid(false);
    }

    const selectionLabel =
        selectedValue === undefined ? 'Not selected' : `${selectedValue} of ${max}`;
    const scaleStatus = isConstraintInvalid ? `Select a ${presentation}.` : selectionLabel;

    if (isSubmitted)
        return (
            <SubmittedScale
                label={label}
                values={values}
                selectedValue={selectedValue}
                presentation={presentation}
                compact={isCompact}
                selectionLabel={selectionLabel}
            />
        );

    function select(nextValue: number): void {
        if (isLocked) {
            return;
        }
        if (value === undefined) {
            setInternalValue(nextValue);
        }
        setIsConstraintInvalid(false);
        onChange?.(nextValue);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentValue: number): void {
        const nextValue = getKeyboardScaleValue(event.key, currentValue, min, max);
        if (nextValue !== undefined) {
            event.preventDefault();
            select(nextValue);
            controlsRef.current.get(nextValue)?.focus();
        }
    }

    return (
        <fieldset
            className={styles.scale}
            data-compact={isCompact || undefined}
            disabled={disabled}
        >
            <legend>{label}</legend>
            {/* eslint-disable-next-line jsx-a11y-x/interactive-supports-focus -- a radiogroup moves focus between its radios (roving tabindex); the group itself takes none. */}
            <div
                aria-describedby={feedbackId}
                aria-invalid={isConstraintInvalid || undefined}
                aria-label={label}
                aria-readonly={readOnly || undefined}
                aria-required={isConstraintRequired || undefined}
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
                    const isSelected = scaleValue === selectedValue;
                    const isActive = isFilled(presentation, scaleValue, activeValue);
                    return (
                        <button
                            aria-checked={isSelected}
                            aria-label={`${scaleValue} of ${max}`}
                            className={styles.scale__option}
                            data-active={isActive || undefined}
                            data-selected={isSelected || undefined}
                            disabled={disabled}
                            key={scaleValue}
                            onClick={() => select(scaleValue)}
                            onFocus={() => {
                                if (!isLocked) {
                                    setPreviewValue(scaleValue);
                                }
                            }}
                            onKeyDown={(event) => handleKeyDown(event, scaleValue)}
                            onMouseEnter={() => {
                                if (!isLocked) {
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
                                isSelected ||
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
            {isConstraintRequired ? (
                <input
                    aria-hidden="true"
                    className="visually-hidden"
                    data-scale-constraint
                    onChange={() => undefined}
                    onInvalid={(event) => {
                        event.preventDefault();
                        setIsConstraintInvalid(true);
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

/** The read-only result after submission: the same rail, without radios or focus. */
function SubmittedScale({
    label,
    values,
    selectedValue,
    presentation,
    compact,
    selectionLabel,
}: {
    label: string;
    values: readonly number[];
    selectedValue: number | undefined;
    presentation: IScaleControlProps['presentation'];
    compact: boolean;
    selectionLabel: string;
}) {
    return (
        <fieldset
            className={styles.scale}
            data-compact={compact || undefined}
            data-submitted="true"
        >
            <legend>{label}</legend>
            <div aria-hidden="true" className={styles.scale__rail} data-presentation={presentation}>
                {values.map((scaleValue) => (
                    <span
                        className={styles.scale__option}
                        data-active={isFilled(presentation, scaleValue, selectedValue) || undefined}
                        data-selected={scaleValue === selectedValue || undefined}
                        key={scaleValue}
                    >
                        {presentation === 'rating' ? '★' : scaleValue}
                    </span>
                ))}
            </div>
            <p className="visually-hidden">Submitted: {selectionLabel}</p>
        </fieldset>
    );
}
