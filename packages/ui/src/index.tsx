import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export { BRAND_ASSETS, BrandImage, type BrandAssetKey, type BrandImageProps } from "./brand-assets.js";
export {
  Dialog,
  FilmStripMenu,
  RatingControl,
  ScaleControl,
  ScoreControl,
  Tabs,
  createInclusiveScale,
  type DialogProps,
  type FilmStripMenuItem,
  type FilmStripMenuProps,
  type ScaleControlProps,
  type TabItem,
  type TabsProps,
} from "./interactive.js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "secondary-danger" | "danger";
type ButtonSize = "default" | "small";
type FeedbackTone = "neutral" | "success" | "warning" | "danger";

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly success?: boolean;
}

export function Button({
  children,
  className,
  disabled,
  loading = false,
  size = "default",
  success = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={classes("pf-button", `pf-button--${variant}`, size === "small" && "pf-button--small", className)}
      data-state={success ? "success" : loading ? "loading" : undefined}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? <span aria-hidden="true" className="pf-spinner" /> : null}
      <span className="pf-button__label">{children}</span>
    </button>
  );
}

export interface ActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly variant?: Exclude<ButtonVariant, "danger">;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
}

export function ActionLink({
  children,
  className,
  disabled = false,
  href,
  onClick,
  size = "default",
  tabIndex,
  variant = "secondary",
  ...props
}: ActionLinkProps) {
  return (
    <a
      {...props}
      aria-disabled={disabled || undefined}
      className={classes("pf-button", `pf-button--${variant}`, size === "small" && "pf-button--small", className)}
      href={disabled ? undefined : href}
      onClick={
        disabled
          ? (event) => {
              event.preventDefault();
            }
          : onClick
      }
      tabIndex={disabled ? -1 : tabIndex}
    >
      <span className="pf-button__label">{children}</span>
    </a>
  );
}

interface FieldMessageProps {
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly success?: string | undefined;
  readonly messageId: string;
}

function FieldMessage({ error, hint, messageId, success }: FieldMessageProps) {
  const message = error ?? success ?? hint;
  if (!message) {
    return null;
  }

  return (
    <span className="pf-field__message" data-tone={error ? "danger" : success ? "success" : "neutral"} id={messageId}>
      {message}
    </span>
  );
}

interface SharedFieldProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly success?: string;
  readonly className?: string;
}

export interface TextFieldProps
  extends SharedFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> {}

export function TextField({ className, error, hint, id, label, success, ...props }: TextFieldProps) {
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error ?? success ?? hint);

  return (
    <label className={classes("pf-field", className)} htmlFor={id}>
      <span className="pf-field__label">{label}</span>
      <input
        {...props}
        aria-describedby={hasMessage ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        className="pf-control"
        data-state={error ? "error" : success ? "success" : undefined}
        id={id}
      />
      <FieldMessage error={error} hint={hint} messageId={messageId} success={success} />
    </label>
  );
}

export interface TextAreaFieldProps
  extends SharedFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id"> {}

export function TextAreaField({ className, error, hint, id, label, success, ...props }: TextAreaFieldProps) {
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error ?? success ?? hint);

  return (
    <label className={classes("pf-field", className)} htmlFor={id}>
      <span className="pf-field__label">{label}</span>
      <textarea
        {...props}
        aria-describedby={hasMessage ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        className="pf-control pf-control--textarea"
        data-state={error ? "error" : success ? "success" : undefined}
        id={id}
      />
      <FieldMessage error={error} hint={hint} messageId={messageId} success={success} />
    </label>
  );
}

export interface SelectFieldProps
  extends SharedFieldProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> {}

export function SelectField({ children, className, error, hint, id, label, success, ...props }: SelectFieldProps) {
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error ?? success ?? hint);

  return (
    <label className={classes("pf-field", className)} htmlFor={id}>
      <span className="pf-field__label">{label}</span>
      <select
        {...props}
        aria-describedby={hasMessage ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        className="pf-control pf-control--select"
        data-state={error ? "error" : success ? "success" : undefined}
        id={id}
      >
        {children}
      </select>
      <FieldMessage error={error} hint={hint} messageId={messageId} success={success} />
    </label>
  );
}

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  readonly label: string;
  readonly description?: string;
  readonly className?: string;
}

export function Toggle({ className, description, id, label, ...props }: ToggleProps) {
  const descriptionId = id && description ? `${id}-description` : undefined;

  return (
    <label className={classes("pf-toggle", className)} htmlFor={id}>
      <span className="pf-toggle__copy">
        <span className="pf-toggle__label">{label}</span>
        {description ? (
          <span className="pf-toggle__description" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
      <span className="pf-toggle__track">
        <input {...props} aria-describedby={descriptionId} id={id} type="checkbox" />
        <span aria-hidden="true" className="pf-toggle__thumb" />
      </span>
    </label>
  );
}

export interface AlertProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly tone?: FeedbackTone;
  readonly className?: string;
}

export function Alert({ children, className, title, tone = "neutral" }: AlertProps) {
  return (
    <div
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={classes("pf-alert", className)}
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="pf-alert__mark" />
      <span>
        {title ? <strong className="pf-alert__title">{title}</strong> : null}
        <span className="pf-alert__body">{children}</span>
      </span>
    </div>
  );
}

export interface StatusBannerProps {
  readonly children: ReactNode;
  readonly label?: string;
  readonly tone?: FeedbackTone;
}

export function StatusBanner({ children, label = "Session status", tone = "neutral" }: StatusBannerProps) {
  return (
    <section aria-label={label} className="pf-status-banner" data-tone={tone}>
      <span aria-hidden="true" className="pf-status-banner__icon">i</span>
      <span>{children}</span>
    </section>
  );
}

export interface ProgressFilmStripProps {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly compact?: boolean;
}

export function ProgressFilmStrip({ compact = false, label, max, value }: ProgressFilmStripProps) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.min(Math.max(0, value), safeMax);

  return (
    <div className="pf-progress" data-compact={compact || undefined}>
      <div className="pf-progress__copy">
        <span>{label}</span>
        <strong>{safeValue}/{safeMax}</strong>
      </div>
      <progress aria-label={label} max={safeMax} value={safeValue} />
    </div>
  );
}

export interface DataTableColumn {
  readonly key: string;
  readonly header: ReactNode;
  readonly numeric?: boolean;
}

export interface DataTableRow {
  readonly id: string;
  readonly cells: Readonly<Record<string, ReactNode>>;
}

export interface DataTableProps {
  readonly caption: string;
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly DataTableRow[];
  readonly emptyMessage?: string;
}

export function DataTable({ caption, columns, emptyMessage = "No records yet.", rows }: DataTableProps) {
  return (
    <div aria-label={`${caption} scroll region`} className="pf-table-scroll" role="region" tabIndex={0}>
      <table className="pf-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.numeric ? "pf-table__numeric" : undefined} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td className={column.numeric ? "pf-table__numeric" : undefined} key={column.key}>
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td className="pf-table__empty" colSpan={columns.length}>{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface EmptyStateProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

export function EmptyState({ action, children, title }: EmptyStateProps) {
  return (
    <section className="pf-empty-state">
      <span aria-hidden="true" className="pf-sprocket"><i /><i /><i /></span>
      <h3>{title}</h3>
      <div>{children}</div>
      {action ? <div className="pf-empty-state__action">{action}</div> : null}
    </section>
  );
}

export interface LoadingStateProps {
  readonly label: string;
  readonly lines?: number;
}

export function LoadingState({ label, lines = 3 }: LoadingStateProps) {
  return (
    <div aria-live="polite" aria-busy="true" className="pf-loading-state" role="status">
      <span className="pf-visually-hidden">{label}</span>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <span aria-hidden="true" className="pf-skeleton" key={index} />
      ))}
    </div>
  );
}

export interface PillProps {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "warm" | "success" | "warning" | "danger";
}

export function Pill({ children, tone = "neutral" }: PillProps) {
  return <span className="pf-pill" data-tone={tone}>{children}</span>;
}

export interface ScaffoldPanelProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function ScaffoldPanel({ children, eyebrow, title }: ScaffoldPanelProps) {
  return (
    <main className="scaffold-panel">
      <p className="scaffold-panel__eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="scaffold-panel__body">{children}</div>
    </main>
  );
}
