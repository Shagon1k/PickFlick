"use client";

import { Button, Dialog, RatingControl, ScoreControl } from "@pickflick/ui";
import { useState } from "react";

import styles from "./preview.module.css";

export function PreviewInteractions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);

  return (
    <div className={styles.scaleStack}>
      <ScoreControl defaultValue={2} label="Selection score" max={4} min={0} name="preview-score" />
      <RatingControl defaultValue={7} label="Session rating" name="preview-rating" />
      <ScoreControl defaultValue={3} label="Submitted score" max={5} name="submitted-score" submitted />
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
