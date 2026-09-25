import type { RefObject } from "react";

import styles from "./shells.module.css";

export function NotificationsPanel({
  id,
  mobile = false,
  open,
  panelRef,
}: Readonly<{ id: string; mobile?: boolean; open: boolean; panelRef: RefObject<HTMLDivElement | null> }>) {
  return (
    <div
      aria-label="Notifications"
      className={mobile ? `${styles.notifPopover} ${styles.notifPopoverMobile}` : styles.notifPopover}
      data-open={open || undefined}
      id={id}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className={styles.notifHeader}>
        <div>
          <h2>Notifications</h2>
          <span>You’re all caught up</span>
        </div>
        <button disabled type="button">Mark all as read</button>
      </div>
      <p className={styles.overlayEmpty}>No notifications yet.</p>
    </div>
  );
}
