"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type { ClubMemberProjection, ClubSettingsProjection } from "@pickflick/contracts";
import { Button, Dialog, Pill, SelectField, TextAreaField, TextField } from "@pickflick/ui";

import {
  changeClubMemberRoleAction,
  clubLifecycleAction,
  removeClubAvatarAction,
  updateClubSettingsAction,
  uploadClubAvatarAction,
} from "../../app/clubs/[clubId]/settings/actions";
import { initialClubManagementState, type ClubManagementActionState } from "./club-management.types";
import styles from "./club-settings.module.css";

function useOperationId(state: ClubManagementActionState): string {
  const [operationId, setOperationId] = useState("");
  const refreshedRevision = useRef(-1);
  useEffect(() => {
    if (!operationId || (state.status === "success" && refreshedRevision.current !== state.revision)) {
      refreshedRevision.current = state.revision;
      setOperationId(globalThis.crypto.randomUUID());
    }
  }, [operationId, state.revision, state.status]);
  return operationId;
}

function ActionStatus({ state }: Readonly<{ state: ClubManagementActionState }>) {
  return (
    <p aria-atomic="true" aria-live="polite" className={styles.status} data-tone={state.status} role="status">
      {state.message}
    </p>
  );
}

function SettingsForm({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const action = updateClubSettingsAction.bind(null, projection.club.id);
  const [state, formAction, pending] = useActionState(action, initialClubManagementState);
  const operationId = useOperationId(state);
  const writable = projection.permissions.manageSettings && projection.club.lifecycle === "ACTIVE";
  return (
    <form action={formAction} className={styles.stack}>
      <input name="operationId" type="hidden" value={operationId} />
      <div className={styles.fields}>
        <TextField
          defaultValue={projection.club.name}
          disabled={!writable}
          id="club-name"
          label="Club name"
          maxLength={100}
          minLength={3}
          name="name"
          required
        />
        <TextAreaField
          defaultValue={projection.club.description ?? ""}
          disabled={!writable}
          id="club-description"
          label="Description"
          maxLength={500}
          name="description"
          rows={4}
        />
        <div className={styles.scaleFields}>
          <SelectField
            defaultValue={String(projection.club.selectionScaleMin)}
            disabled={!writable}
            id="selection-scale-min"
            label="Selection starts at"
            name="selectionScaleMin"
          >
            <option value="0">0</option>
            <option value="1">1</option>
          </SelectField>
          <SelectField
            defaultValue={String(projection.club.selectionScaleMax)}
            disabled={!writable}
            id="selection-scale-max"
            label="Selection ends at"
            name="selectionScaleMax"
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) =>
              <option key={value} value={String(value)}>{value}</option>
            )}
          </SelectField>
        </div>
      </div>
      <fieldset className={styles.toggles} disabled={!writable}>
        <legend>Visibility and presentation</legend>
        <Toggle defaultChecked={projection.visibility.showNominationAuthors} label="Show who nominated each film" name="showNominationAuthors" />
        <Toggle defaultChecked={projection.visibility.showNominationsBeforeSubmit} label="Show current nominations before submission" name="showNominationsBeforeSubmit" />
        <Toggle
          defaultChecked={projection.visibility.showVoteResults}
          disabled={projection.entitlements.voteResultVisibility !== "ADMIN_CONFIGURABLE"}
          label="Show Selection results after the round closes"
          name="showVoteResults"
        />
        {projection.entitlements.voteResultVisibility !== "ADMIN_CONFIGURABLE" ? (
          <p className={styles.explanation}>Free Clubs keep individual Selection results hidden.</p>
        ) : null}
        <Toggle defaultChecked={projection.visibility.showRatingResults} label="Show ratings after the round closes" name="showRatingResults" />
        <Toggle defaultChecked={projection.visibility.useMonochromeMedia} label="Use black and white for posters and trailers" name="useMonochromeMedia" />
      </fieldset>
      {!writable ? (
        <p className={styles.explanation}>
          {projection.club.lifecycle === "ARCHIVED"
            ? "Archived Clubs are read-only until an Admin reactivates them."
            : "Only the Club Admin can change these settings."}
        </p>
      ) : null}
      <div className={styles.formFooter}>
        <Button disabled={!writable || !operationId} loading={pending} type="submit">Save settings</Button>
        <ActionStatus state={state} />
      </div>
    </form>
  );
}

function Toggle({ defaultChecked, disabled = false, label, name }: Readonly<{
  defaultChecked: boolean;
  disabled?: boolean;
  label: string;
  name: string;
}>) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input defaultChecked={defaultChecked} disabled={disabled} name={name} type="checkbox" />
    </label>
  );
}

function AvatarForm({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const upload = uploadClubAvatarAction.bind(null, projection.club.id);
  const remove = removeClubAvatarAction.bind(null, projection.club.id);
  const [uploadState, uploadAction, uploadPending] = useActionState(upload, initialClubManagementState);
  const [removeState, removeAction, removePending] = useActionState(remove, initialClubManagementState);
  const uploadOperationId = useOperationId(uploadState);
  const removeOperationId = useOperationId(removeState);
  const [latestAction, setLatestAction] = useState<"remove" | "upload">("upload");
  const writable = projection.permissions.manageSettings && projection.club.lifecycle === "ACTIVE";
  const state = latestAction === "remove" ? removeState : uploadState;
  const avatarVersion = projection.club.avatarVersion
    ? `?v=${encodeURIComponent(projection.club.avatarVersion)}`
    : "";
  return (
    <div className={styles.avatarLayout}>
      <div className={styles.avatar}>
        {projection.club.hasAvatar ? (
          // The authenticated API route performs the membership check before streaming the image.
          <img alt={`${projection.club.name} avatar`} src={`/api/clubs/${projection.club.id}/avatar${avatarVersion}`} />
        ) : <span aria-hidden="true">{projection.club.name.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div className={styles.stack}>
        <form action={uploadAction} className={styles.inlineForm} onSubmit={() => setLatestAction("upload")}>
          <input name="operationId" type="hidden" value={uploadOperationId} />
          <label className={styles.fileLabel}>
            <span>Club avatar</span>
            <input accept="image/png,image/jpeg,image/webp" disabled={!writable} name="avatar" required type="file" />
          </label>
          <Button disabled={!writable || !uploadOperationId} loading={uploadPending} size="small" type="submit">Upload</Button>
        </form>
        {projection.club.hasAvatar ? (
          <form action={removeAction} onSubmit={() => setLatestAction("remove")}>
            <input name="operationId" type="hidden" value={removeOperationId} />
            <Button disabled={!writable || !removeOperationId} loading={removePending} size="small" type="submit" variant="secondary">Remove avatar</Button>
          </form>
        ) : null}
        <p className={styles.explanation}>PNG, JPEG, or WebP. Maximum 512 KiB. Stored privately.</p>
        <ActionStatus state={state} />
      </div>
    </div>
  );
}

function MemberRoleForm({ clubId, member, writable }: Readonly<{
  clubId: string;
  member: ClubMemberProjection;
  writable: boolean;
}>) {
  const action = changeClubMemberRoleAction.bind(null, clubId, member.id);
  const [state, formAction, pending] = useActionState(action, initialClubManagementState);
  const operationId = useOperationId(state);
  if (member.role === "ADMIN") {
    return <span className={styles.lockedRole}>Admin · ownership locked</span>;
  }
  return (
    <form action={formAction} className={styles.roleForm}>
      <input name="operationId" type="hidden" value={operationId} />
      <label className="pf-visually-hidden" htmlFor={`role-${member.id}`}>Role for {member.displayName}</label>
      <select defaultValue={member.role} disabled={!writable} id={`role-${member.id}`} name="nextRole">
        <option value="MODERATOR">Moderator</option>
        <option value="MEMBER">Member</option>
      </select>
      <Button disabled={!writable || !operationId} loading={pending} size="small" type="submit" variant="secondary">Save role</Button>
      <ActionStatus state={state} />
    </form>
  );
}

function ConfirmAction({
  action,
  clubId,
  confirmation,
  description,
  label,
  title,
  variant = "secondary-danger",
}: Readonly<{
  action: "archive" | "delete" | "leave";
  clubId: string;
  confirmation: string;
  description: string;
  label: string;
  title: string;
  variant?: "secondary-danger" | "danger";
}>) {
  const serverAction = clubLifecycleAction.bind(null, clubId, action);
  const [state, formAction, pending] = useActionState(serverAction, initialClubManagementState);
  const operationId = useOperationId(state);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="small" variant={variant}>{label}</Button>
      <Dialog onClose={() => setOpen(false)} open={open} title={title} tone="danger">
        <form action={formAction} className={styles.dialogForm}>
          <p>{description}</p>
          <input name="operationId" type="hidden" value={operationId} />
          <TextField
            autoComplete="off"
            id={`${action}-confirmation`}
            label={`Type ${confirmation} to confirm`}
            name="confirmation"
            required
          />
          <ActionStatus state={state} />
          <div className={styles.dialogActions}>
            <Button onClick={() => setOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={!operationId} loading={pending} type="submit" variant="danger">Confirm {label.toLowerCase()}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ReactivateAction({ clubId }: Readonly<{ clubId: string }>) {
  const action = clubLifecycleAction.bind(null, clubId, "reactivate");
  const [state, formAction, pending] = useActionState(action, initialClubManagementState);
  const operationId = useOperationId(state);
  return (
    <form action={formAction} className={styles.stack}>
      <input name="operationId" type="hidden" value={operationId} />
      <Button disabled={!operationId} loading={pending} type="submit">Reactivate Club</Button>
      <ActionStatus state={state} />
    </form>
  );
}

export function ClubSettings({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const active = projection.club.lifecycle === "ACTIVE";
  const isAdmin = projection.club.membershipRole === "ADMIN";
  return (
    <main className={styles.layout}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Club controls</p>
          <h1>{projection.club.name}</h1>
          <p>Settings, member roles, lifecycle, and audit evidence for this private Club.</p>
        </div>
        <div className={styles.badges}>
          <Pill tone={active ? "warm" : "neutral"}>{active ? "Active" : "Archived"}</Pill>
          <Pill>{projection.club.membershipRole === "ADMIN" ? "Admin" : projection.club.membershipRole.toLowerCase()}</Pill>
          <Pill>{projection.club.tier === "FREE" ? "Free" : "Pro"}</Pill>
        </div>
      </div>

      {!isAdmin ? (
        <aside className={styles.notice}>
          You can review Club settings and members. Only the Club Admin can change settings, roles, or lifecycle.
        </aside>
      ) : null}
      {!active ? <aside className={styles.notice}>This Club is archived. History remains visible, but ordinary changes are paused.</aside> : null}

      <section aria-labelledby="club-information" className={styles.card}>
        <h2 id="club-information">Club information</h2>
        <AvatarForm projection={projection} />
        <SettingsForm projection={projection} />
      </section>

      <section aria-labelledby="club-members" className={styles.card}>
        <div className={styles.sectionHeading}>
          <div><h2 id="club-members">Members</h2><p>{projection.members.length} active members</p></div>
          <Pill>{projection.members.length} / {projection.entitlements.memberLimit}</Pill>
        </div>
        <div className={styles.memberList}>
          {projection.members.map((member) => (
            <article className={styles.member} key={member.id}>
              <div className={styles.memberIdentity}>
                <span aria-hidden="true">{member.displayName.slice(0, 2).toUpperCase()}</span>
                <div><strong>{member.displayName}</strong><small>Joined {new Date(member.joinedAt).toLocaleDateString("en")}</small></div>
              </div>
              <MemberRoleForm clubId={projection.club.id} member={member} writable={projection.permissions.manageRoles && active} />
            </article>
          ))}
        </div>
      </section>

      {projection.permissions.viewAudit ? (
        <section aria-labelledby="club-audit" className={styles.card}>
          <div className={styles.sectionHeading}><div><h2 id="club-audit">Recent audit evidence</h2><p>Categorical events only; request bodies and personal details are not recorded here.</p></div></div>
          {projection.auditEvents.length ? (
            <ol className={styles.auditList}>
              {projection.auditEvents.map((event) => (
                <li key={event.id}>
                  <span>{event.action.replaceAll("_", " ").toLowerCase()}</span>
                  <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("en")}</time>
                </li>
              ))}
            </ol>
          ) : <p className={styles.explanation}>No audited Club changes yet.</p>}
        </section>
      ) : null}

      <section aria-labelledby="club-lifecycle" className={`${styles.card} ${styles.dangerCard}`}>
        <h2 id="club-lifecycle">Club lifecycle</h2>
        {isAdmin ? (
          active ? (
            <div className={styles.dangerActions}>
              <div><strong>Archive Club</strong><p>Pause changes while keeping member access and history available.</p></div>
              <ConfirmAction action="archive" clubId={projection.club.id} confirmation="ARCHIVE" description="The Club becomes read-only until you reactivate it." label="Archive Club" title="Archive this Club?" />
              <div><strong>Delete empty Club</strong><p>Removes active access. Clubs with Session history cannot be deleted.</p></div>
              <ConfirmAction action="delete" clubId={projection.club.id} confirmation={projection.club.name} description="This removes every active Membership and cannot be undone from the Club UI." label="Delete Club" title="Delete this Club?" />
            </div>
          ) : <ReactivateAction clubId={projection.club.id} />
        ) : (
          <div className={styles.dangerActions}>
            <div><strong>Leave Club</strong><p>Your Membership ends immediately. Shared Club history remains.</p></div>
            <ConfirmAction action="leave" clubId={projection.club.id} confirmation="LEAVE" description="You will lose access to this private Club. Shared history remains for its members." label="Leave Club" title="Leave this Club?" />
          </div>
        )}
        {isAdmin && active ? <p className={styles.explanation}>Admins cannot leave their own Club. Transfer administration requires the App Admin recovery path, or delete an empty Club.</p> : null}
      </section>
    </main>
  );
}
