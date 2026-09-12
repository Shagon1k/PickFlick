"use client";

import {
  Button,
  Dialog,
  RatingControl,
  ScoreControl,
  SelectField,
  Tabs,
  TextField,
} from "@pickflick/ui";
import { useState } from "react";

import styles from "./preview.module.css";

export function PreviewInteractions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);
  const [adjustableMax, setAdjustableMax] = useState(5);

  return (
    <div className={styles.scaleStack}>
      <ScoreControl defaultValue={2} label="Selection score" max={4} min={0} name="preview-score" />
      <RatingControl defaultValue={7} label="Session rating" name="preview-rating" />
      <ScoreControl defaultValue={3} label="Submitted score" max={5} name="submitted-score" submitted />
      <ScoreControl defaultValue={5} label="Adjustable score" max={adjustableMax} name="adjustable-score" />
      <Button onClick={() => setAdjustableMax((current) => current === 5 ? 4 : 5)} variant="ghost">
        {adjustableMax === 5 ? "Reduce adjustable scale" : "Restore adjustable scale"}
      </Button>
      <div className={styles.dialogActions}>
        <Button onClick={() => setDialogOpen(true)} variant="secondary">Open dialog</Button>
        <Button onClick={() => setDangerDialogOpen(true)} variant="secondary-danger">Delete Club</Button>
      </div>
      <Dialog
        actions={<Button onClick={() => setDialogOpen(false)}>Continue</Button>}
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        title="Move to Selection?"
      >
        Members who have not nominated will lose their remaining nomination opportunity.
      </Dialog>
      <Dialog
        actions={
          <>
            <Button onClick={() => setDangerDialogOpen(false)} variant="secondary">Cancel</Button>
            <Button onClick={() => setDangerDialogOpen(false)} variant="danger">Delete Club</Button>
          </>
        }
        onClose={() => setDangerDialogOpen(false)}
        open={dangerDialogOpen}
        title="Delete Friday Night?"
        tone="danger"
      >
        This irreversible action belongs in a separate confirmation context.
      </Dialog>
    </div>
  );
}

export function ReviewFixInteractions() {
  const [feedback, setFeedback] = useState<"error" | "success" | undefined>();
  const [secondTabDisabled, setSecondTabDisabled] = useState(false);
  const [secondTabRemoved, setSecondTabRemoved] = useState(false);
  const [submittedValue, setSubmittedValue] = useState("Not submitted");
  const tabItems = [
    { id: "first", label: "First enabled", content: "First enabled panel" },
    ...(secondTabRemoved
      ? []
      : [{
          id: "selected",
          label: "Selected tab",
          content: "Selected panel",
          disabled: secondTabDisabled,
        }]),
  ];

  return (
    <div className={styles.gridWide}>
      <form
        aria-label="Required select form"
        className={`${styles.panel} ${styles.formStack}`}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedValue(String(new FormData(event.currentTarget).get("required-range")));
        }}
      >
        <SelectField
          id="required-range"
          label="Required selection range"
          name="required-range"
          placeholder="Choose a range"
          required
        >
          <option value="0-4">0 to 4</option>
          <option value="1-5">1 to 5</option>
        </SelectField>
        <Button type="submit" variant="secondary">Submit required select</Button>
        <output data-submitted-value>{submittedValue}</output>
      </form>
      <div className={`${styles.panel} ${styles.formStack}`}>
        <Tabs initialId="selected" items={tabItems} label="Changing views" />
        <div className={styles.buttonRow}>
          <Button
            onClick={() => setSecondTabDisabled((current) => !current)}
            variant="ghost"
          >
            {secondTabDisabled ? "Enable selected tab" : "Disable selected tab"}
          </Button>
          <Button
            onClick={() => setSecondTabRemoved((current) => !current)}
            variant="ghost"
          >
            {secondTabRemoved ? "Restore selected tab" : "Remove selected tab"}
          </Button>
        </div>
      </div>
      <div className={`${styles.panel} ${styles.formStack}`}>
        <TextField
          id="async-club-name"
          label="Async Club name"
          {...(feedback === "error" ? { error: "Club name could not be saved." } : {})}
          {...(feedback === "success" ? { success: "Club name saved." } : {})}
        />
        <div className={styles.buttonRow}>
          <Button onClick={() => setFeedback("error")} variant="ghost">Show async error</Button>
          <Button onClick={() => setFeedback("success")} variant="ghost">Show async success</Button>
        </div>
      </div>
    </div>
  );
}
