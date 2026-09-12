import { readFile } from "node:fs/promises";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Alert,
  BRAND_ASSETS,
  Button,
  DataTable,
  Dialog,
  ProgressFilmStrip,
  ProjectorNoirProvider,
  SelectField,
  Tabs,
  TextAreaField,
  TextField,
  Toggle,
  createInclusiveScale,
  projectorNoirTheme,
} from "../index.js";

interface ElementProps {
  readonly children?: ReactNode;
  readonly [key: string]: unknown;
}

function descendants(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => descendants(child));
  }
  if (!isValidElement<ElementProps>(node)) {
    return [];
  }
  return [node, ...descendants(node.props.children)];
}

describe("Projector Noir primitives", () => {
  it("keeps loading actions native, named, and non-repeatable", () => {
    const button = Button({ children: "Create Session", loading: true });

    expect(button.type).toBe("button");
    expect(button.props.type).toBe("button");
    expect(button.props.disabled).toBe(true);
    expect(button.props["aria-busy"]).toBe(true);
    expect(descendants(button).some((element) => element.props.children === "Create Session")).toBe(true);
  });

  it("keeps field messages outside the control label", () => {
    const field = TextField({ id: "club-name", label: "Club name", error: "Use at least 3 characters." });
    const nodes = descendants(field);
    const label = nodes.find((element) => element.type === "label");
    const input = nodes.find((element) => element.type === "input");

    expect(field.type).toBe("div");
    expect(label?.props.htmlFor).toBe("club-name");
    expect(input?.props.id).toBe("club-name");
    expect(input?.props["aria-invalid"]).toBe(true);
    expect(input?.props["aria-describedby"]).toBe("club-name-message");
    expect(descendants(label).some((element) => element.props.messageId === "club-name-message")).toBe(false);
    expect(nodes.some((element) => element.props.messageId === "club-name-message")).toBe(true);
  });

  it("keeps an empty field-message region mounted", () => {
    const markup = renderToStaticMarkup(TextField({ id: "title", label: "Title" }));

    expect(markup).toContain('id="title-message"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('data-field-live="error"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('data-field-live="success"');
    expect(markup.match(/aria-atomic="true"/g)).toHaveLength(2);
  });

  it("preserves caller-provided field relationships and invalid states", () => {
    const fields = [
      TextField({
        "aria-describedby": "external-instructions",
        "aria-invalid": "spelling",
        error: "Review this value.",
        id: "title",
        label: "Title",
      }),
      TextAreaField({
        "aria-describedby": "external-instructions",
        "aria-invalid": false,
        hint: "Optional context.",
        id: "notes",
        label: "Notes",
      }),
      SelectField({
        "aria-describedby": "external-instructions",
        "aria-invalid": true,
        children: null,
        id: "range",
        label: "Range",
      }),
    ];

    const controls = fields.map((field) =>
      descendants(field).find((element) =>
        ["input", "textarea"].includes(String(element.type)) ||
        (element.type as { name?: string }).name === "ConstraintSelect",
      ),
    );

    expect(controls[0]?.props["aria-describedby"]).toBe("external-instructions title-message");
    expect(controls[0]?.props["aria-invalid"]).toBe("spelling");
    expect(controls[1]?.props["aria-describedby"]).toBe("external-instructions notes-message");
    expect(controls[1]?.props["aria-invalid"]).toBe(false);
    expect(controls[2]?.props["aria-describedby"]).toBe("external-instructions");
    expect(controls[2]?.props["aria-invalid"]).toBe(true);
  });

  it("merges caller-provided and generated toggle descriptions", () => {
    const toggle = Toggle({
      "aria-describedby": "privacy-policy",
      description: "Receive a reminder while Rating remains open.",
      id: "rating-reminders",
      label: "Rating reminders",
    });
    const input = descendants(toggle).find((element) => element.type === "input");

    expect(input?.props["aria-describedby"]).toBe("privacy-policy rating-reminders-description");
    expect(input?.props["aria-labelledby"]).toBe("rating-reminders-label");
    expect(
      descendants(toggle).find((element) => element.props.id === "rating-reminders-label")?.props.children,
    ).toBe("Rating reminders");
  });

  it("adapts select options and forwards required form constraints", () => {
    const field = SelectField({
      children: [
        createElement("option", { key: "0-4", value: "0-4" }, "0 to 4"),
        createElement("option", { key: "1-5", value: "1-5" }, "1 to 5"),
      ],
      defaultValue: "0-4",
      id: "score-range",
      label: "Selection range",
      name: "score-range",
      required: true,
    });
    const select = descendants(field).find(
      (element) => (element.type as { name?: string }).name === "ConstraintSelect",
    );

    expect(select?.props.data).toEqual([
      { value: "0-4", label: "0 to 4" },
      { value: "1-5", label: "1 to 5" },
    ]);
    expect(select?.props.allowDeselect).toBe(false);
    expect(select?.props.name).toBe("score-range");
    expect(select?.props.required).toBe(true);
    expect(select?.props.classNames).toMatchObject({
      dropdown: "pf-select__dropdown",
      input: "pf-control pf-control--select",
      option: "pf-select__option",
    });
  });

  it("configures Mantine mechanics behind branded tabs and dialogs", () => {
    const tabs = renderToStaticMarkup(
      createElement(
        ProjectorNoirProvider,
        null,
        createElement(Tabs, {
          items: [{ id: "overview", label: "Overview", content: "Overview panel" }],
          label: "Club views",
        }),
      ),
    );
    const dialog = Dialog({ children: "Dialog body", onClose: () => undefined, open: true, title: "Move phase?" });

    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('aria-label="Club views"');
    expect(tabs).toContain('aria-selected="true"');
    expect((dialog.type as { displayName?: string }).displayName).toBe("@mantine/core/Modal");
    expect(dialog.props.trapFocus).toBe(true);
    expect(dialog.props.returnFocus).toBe(true);
    expect(dialog.props.closeOnEscape).toBe(true);
    expect(dialog.props.classNames).toMatchObject({ content: "pf-dialog", overlay: "pf-dialog__overlay" });
  });

  it("uses explicit live-region semantics for feedback", () => {
    const failure = Alert({ children: "Try again.", tone: "danger" });
    const success = Alert({ children: "Saved.", tone: "success" });

    expect(failure.props.role).toBe("alert");
    expect(failure.props["aria-live"]).toBe("assertive");
    expect(success.props.role).toBe("status");
    expect(success.props["aria-live"]).toBe("polite");
  });

  it("clamps native progress values to a meaningful range", () => {
    const progress = ProgressFilmStrip({ label: "Selection", max: 4, value: 9 });
    const nativeProgress = descendants(progress).find((element) => element.type === "progress");

    expect(nativeProgress?.props.max).toBe(4);
    expect(nativeProgress?.props.value).toBe(4);
    expect(nativeProgress?.props["aria-label"]).toBe("Selection");
  });

  it("keeps dense tables semantic and bounds their scrolling", () => {
    const table = DataTable({
      caption: "Selection progress",
      columns: [{ key: "member", header: "Member" }],
      rows: [{ id: "alex", cells: { member: "Alex" } }],
    });
    const nodes = descendants(table);

    expect(table.props.role).toBe("region");
    expect(table.props.tabIndex).toBe(0);
    expect(nodes.some((element) => element.type === "caption")).toBe(true);
    expect(nodes.some((element) => element.type === "th" && element.props.scope === "col")).toBe(true);
  });
});

describe("production contracts", () => {
  it("generates only supported inclusive Club score ranges", () => {
    expect(createInclusiveScale(0, 4)).toEqual([0, 1, 2, 3, 4]);
    expect(createInclusiveScale(1, 10)).toHaveLength(10);
    expect(() => createInclusiveScale(2, 5)).toThrow(/0\.\.N or 1\.\.N/);
    expect(() => createInclusiveScale(1, 11)).toThrow(/no greater than 10/);
  });

  it("exposes every approved brand asset through one semantic registry", () => {
    const assets = Object.entries(BRAND_ASSETS);

    expect(assets).toHaveLength(24);
    expect(assets.every(([, asset]) => asset.width > 0 && asset.height > 0)).toBe(true);
    expect(assets.filter(([, asset]) => asset.containsEmbeddedText).map(([key]) => key)).toEqual([
      "invitationCampaign",
    ]);
    expect(JSON.stringify(BRAND_ASSETS)).not.toMatch(/poster|still|_docs\/design\/prototypes/iu);
  });

  it("ships complete tokens and reduced-motion overrides", async () => {
    const [tokens, primitives] = await Promise.all([
      readFile(new URL("../../styles/tokens.css", import.meta.url), "utf8"),
      readFile(new URL("../../styles/primitives.css", import.meta.url), "utf8"),
    ]);

    for (const token of [
      "--button-primary-hover",
      "--warm-accent",
      "--danger",
      "--success",
      "--warn",
      "--fs-hero",
      "--gap-2xl",
      "--shadow-overlay",
      "--image-noir-rest",
      "--motion-menu",
    ]) {
      expect(tokens).toContain(token);
    }
    expect(primitives).toContain("@media (prefers-reduced-motion: reduce)");
    expect(primitives).toContain(".pf-button:focus-visible");
    expect(primitives).toContain(".pf-control[data-state=\"error\"]");
    expect(primitives).toContain(".pf-button[data-state=\"success\"]");
    expect(primitives).toContain(
      '.pf-button[data-state="loading"] .pf-spinner {\n  position: absolute;',
    );
    expect(primitives).toContain(
      '.pf-scale__rail[data-presentation="rating"] .pf-scale__option {\n  min-width: var(--hit);\n  min-height: var(--hit);\n  flex-basis: var(--hit);',
    );
    expect(primitives).toContain("@media (max-width: 575px) {\n  .pf-button--small {\n    min-height: var(--hit);");
    expect(primitives).toContain(".pf-select__option[data-combobox-selected]");
    expect(primitives).toContain(".pf-dialog__overlay");
    expect(primitives).toContain("min-height: var(--hit)");
  });

  it("maps Projector Noir into Mantine without application imports", async () => {
    const [layout, interactive, provider] = await Promise.all([
      readFile(new URL("../../../../apps/web/src/app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../interactive.tsx", import.meta.url), "utf8"),
      readFile(new URL("../provider.tsx", import.meta.url), "utf8"),
    ]);

    expect(projectorNoirTheme.fontFamily).toBe("var(--font-body)");
    expect(projectorNoirTheme.headings?.fontFamily).toBe("var(--font-display)");
    expect(projectorNoirTheme.primaryColor).toBe("projectorGold");
    expect(projectorNoirTheme.respectReducedMotion).toBe(true);
    expect(layout).not.toContain("@mantine/");
    expect(interactive).toMatch(/MantineMenu|MantineModal|MantineTabs/);
    expect(provider).toContain('withStaticClasses={false}');
  });
});
