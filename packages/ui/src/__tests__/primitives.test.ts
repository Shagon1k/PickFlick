import { readFile } from "node:fs/promises";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  Alert,
  BRAND_ASSETS,
  Button,
  DataTable,
  ProgressFilmStrip,
  SelectField,
  TextAreaField,
  TextField,
  createInclusiveScale,
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

  it("connects field validation to a labeled native input", () => {
    const field = TextField({ id: "club-name", label: "Club name", error: "Use at least 3 characters." });
    const nodes = descendants(field);
    const input = nodes.find((element) => element.type === "input");

    expect(field.type).toBe("label");
    expect(field.props.htmlFor).toBe("club-name");
    expect(input?.props.id).toBe("club-name");
    expect(input?.props["aria-invalid"]).toBe(true);
    expect(input?.props["aria-describedby"]).toBe("club-name-message");
    expect(nodes.some((element) => element.props.messageId === "club-name-message")).toBe(true);
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
      descendants(field).find((element) => ["input", "textarea", "select"].includes(String(element.type))),
    );

    expect(controls[0]?.props["aria-describedby"]).toBe("external-instructions title-message");
    expect(controls[0]?.props["aria-invalid"]).toBe("spelling");
    expect(controls[1]?.props["aria-describedby"]).toBe("external-instructions notes-message");
    expect(controls[1]?.props["aria-invalid"]).toBe(false);
    expect(controls[2]?.props["aria-describedby"]).toBe("external-instructions");
    expect(controls[2]?.props["aria-invalid"]).toBe(true);
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
    expect(primitives).toContain(".pf-film-strip {\n    right: auto;\n    left: 0;");
  });
});
