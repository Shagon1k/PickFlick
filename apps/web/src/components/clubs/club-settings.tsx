"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type { ClubMemberProjection, ClubSettingsProjection } from "@pickflick/contracts";
import { Button, Dialog, TextAreaField, TextField } from "@pickflick/ui";

import {
  changeClubMemberRoleAction,
  clubLifecycleAction,
  removeClubAvatarAction,
  updateClubSettingsAction,
  uploadClubAvatarAction,
} from "../../app/clubs/[clubId]/settings/actions";
import { clubNavigation } from "../shells/shells";
import { initialClubManagementState, type ClubManagementActionState } from "./club-management.types";
import styles from "./club-settings.module.css";
import { SelectionScaleField } from "./selection-scale-field";

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

type VisibilityName =
  | "showNominationAuthors"
  | "showNominationsBeforeSubmit"
  | "showVoteResults"
  | "showRatingResults"
  | "useMonochromeMedia";

const visibilityOptions: ReadonlyArray<{ readonly name: VisibilityName; readonly label: string }> = [
  { name: "showNominationAuthors", label: "Show who nominated each film" },
  { name: "showNominationsBeforeSubmit", label: "Show nominations before I submit" },
  { name: "showVoteResults", label: "Show Selection results after the round closes" },
  { name: "showRatingResults", label: "Show ratings after the round closes" },
  { name: "useMonochromeMedia", label: "Use black & white posters and trailers" },
];

function isWritable(projection: ClubSettingsProjection): boolean {
  return projection.permissions.manageSettings && projection.club.lifecycle === "ACTIVE";
}

/**
 * Club Info and Settings save through one settings action; each card submits its own fields and
 * carries the other card's stored values so a save never resets what the other card shows.
 */
function StoredClubInfo({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  return (
    <>
      <input name="name" type="hidden" value={projection.club.name} />
      <input name="description" type="hidden" value={projection.club.description ?? ""} />
      <input name="selectionScaleMin" type="hidden" value={projection.club.selectionScaleMin} />
      <input name="selectionScaleMax" type="hidden" value={projection.club.selectionScaleMax} />
    </>
  );
}

function StoredVisibility({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  return (
    <>
      {visibilityOptions.filter(({ name }) => projection.visibility[name]).map(({ name }) => (
        <input key={name} name={name} type="hidden" value="on" />
      ))}
    </>
  );
}

function SaveRow({ disabled, pending, state }: Readonly<{
  disabled: boolean;
  pending: boolean;
  state: ClubManagementActionState;
}>) {
  return (
    <div className={styles.saveRow}>
      <Button className={styles.saveButton} disabled={disabled} loading={pending} size="small" type="submit">Save Changes</Button>
      <ActionStatus state={state} />
    </div>
  );
}

function ClubInfoCard({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const action = updateClubSettingsAction.bind(null, projection.club.id);
  const [state, formAction, pending] = useActionState(action, initialClubManagementState);
  const operationId = useOperationId(state);
  const writable = isWritable(projection);
  return (
    <section aria-labelledby="club-info-title" className={styles.card}>
      <h2 id="club-info-title">Club Info</h2>
      <form action={formAction} className={styles.stack}>
        <input name="operationId" type="hidden" value={operationId} />
        <StoredVisibility projection={projection} />
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
          rows={3}
        />
        <SelectionScaleField
          defaultMax={projection.club.selectionScaleMax}
          disabled={!writable}
          idPrefix="selection-scale"
          min={projection.club.selectionScaleMin}
        />
        {projection.permissions.manageSettings ? (
          <SaveRow disabled={!writable || !operationId} pending={pending} state={state} />
        ) : null}
      </form>
    </section>
  );
}

function VisibilityCard({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const action = updateClubSettingsAction.bind(null, projection.club.id);
  const [state, formAction, pending] = useActionState(action, initialClubManagementState);
  const operationId = useOperationId(state);
  const writable = isWritable(projection);
  const resultsLocked = projection.entitlements.voteResultVisibility !== "ADMIN_CONFIGURABLE";
  return (
    <section aria-labelledby="club-visibility-title" className={styles.card}>
      <h2 id="club-visibility-title">Settings</h2>
      <form action={formAction} className={styles.stack}>
        <input name="operationId" type="hidden" value={operationId} />
        <StoredClubInfo projection={projection} />
        <fieldset className={styles.checks} disabled={!writable}>
          <legend className="pf-visually-hidden">Visibility and presentation</legend>
          {visibilityOptions.map(({ label, name }) => {
            const locked = name === "showVoteResults" && resultsLocked;
            return (
              <div key={name}>
                <label className={styles.check}>
                  <span>{label}</span>
                  <input defaultChecked={projection.visibility[name]} disabled={locked} name={name} type="checkbox" />
                </label>
                {locked ? <p className={styles.checkNote}>Free Clubs keep individual Selection results hidden.</p> : null}
              </div>
            );
          })}
        </fieldset>
        {projection.permissions.manageSettings ? (
          <SaveRow disabled={!writable || !operationId} pending={pending} state={state} />
        ) : null}
      </form>
    </section>
  );
}

function AvatarCard({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const upload = uploadClubAvatarAction.bind(null, projection.club.id);
  const remove = removeClubAvatarAction.bind(null, projection.club.id);
  const [uploadState, uploadAction, uploadPending] = useActionState(upload, initialClubManagementState);
  const [removeState, removeAction, removePending] = useActionState(remove, initialClubManagementState);
  const uploadOperationId = useOperationId(uploadState);
  const removeOperationId = useOperationId(removeState);
  const [latestAction, setLatestAction] = useState<"remove" | "upload">("upload");
  const writable = isWritable(projection);
  const state = latestAction === "remove" ? removeState : uploadState;
  const avatarVersion = projection.club.avatarVersion
    ? `?v=${encodeURIComponent(projection.club.avatarVersion)}`
    : "";
  return (
    <section aria-labelledby="club-avatar-title" className={styles.card}>
      <h2 id="club-avatar-title">Club Avatar</h2>
      <div className={styles.avatarLayout}>
        <div className={styles.avatar}>
          {projection.club.hasAvatar ? (
            // The authenticated API route performs the membership check before streaming the image.
            <img alt={`${projection.club.name} avatar`} src={`/api/clubs/${projection.club.id}/avatar${avatarVersion}`} />
          ) : <span aria-hidden="true">{projection.club.name.slice(0, 2).toUpperCase()}</span>}
        </div>
        {projection.permissions.manageSettings ? <div className={styles.stack}>
          <form action={uploadAction} className={styles.inlineForm} onSubmit={() => setLatestAction("upload")}>
            <input name="operationId" type="hidden" value={uploadOperationId} />
            <label className={styles.fileLabel}>
              <span className="pf-visually-hidden">Club avatar</span>
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
        </div> : <p className={styles.explanation}>Only the Club Admin can change the avatar.</p>}
      </div>
    </section>
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
    return <span className={styles.lockedRole}>Admin</span>;
  }
  return (
    <form action={formAction} className={styles.roleForm}>
      <input name="operationId" type="hidden" value={operationId} />
      <fieldset className={styles.roleChoice} disabled={!writable}>
        <legend className="pf-visually-hidden">Role for {member.displayName}</legend>
        {(["MEMBER", "MODERATOR"] as const).map((role) => (
          <label key={role}>
            <input defaultChecked={member.role === role} name="nextRole" type="radio" value={role} />
            <span>{role === "MEMBER" ? "Member" : "Moderator"}</span>
          </label>
        ))}
      </fieldset>
      <Button disabled={!writable || !operationId} loading={pending} size="small" type="submit" variant="secondary">Save role</Button>
      <ActionStatus state={state} />
    </form>
  );
}

function ManageModerators({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const [open, setOpen] = useState(false);
  const writable = projection.permissions.manageRoles && projection.club.lifecycle === "ACTIVE";
  return (
    <>
      <Button onClick={() => setOpen(true)} size="small" variant="secondary">Manage Moderators</Button>
      <Dialog onClose={() => setOpen(false)} open={open} title="Manage Moderators">
        <p className={styles.explanation}>
          Moderators run Sessions with you. {projection.members.length} of {projection.entitlements.memberLimit} member places are in use.
        </p>
        <ul className={styles.memberList}>
          {projection.members.map((member) => (
            <li className={styles.member} key={member.id}>
              <div className={styles.memberIdentity}>
                <span aria-hidden="true">{member.displayName.slice(0, 2).toUpperCase()}</span>
                <div><strong>{member.displayName}</strong><small>Joined {new Date(member.joinedAt).toLocaleDateString("en", { timeZone: "UTC" })}</small></div>
              </div>
              <MemberRoleForm clubId={projection.club.id} member={member} writable={writable} />
            </li>
          ))}
        </ul>
      </Dialog>
    </>
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
    <form action={formAction} className={styles.inlineForm}>
      <input name="operationId" type="hidden" value={operationId} />
      <Button disabled={!operationId} loading={pending} size="small" type="submit">Reactivate Club</Button>
      <ActionStatus state={state} />
    </form>
  );
}

function DangerZone({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const active = projection.club.lifecycle === "ACTIVE";
  const isAdmin = projection.club.membershipRole === "ADMIN";
  const clubId = projection.club.id;
  const deleteAction = (
    <ConfirmAction action="delete" clubId={clubId} confirmation={projection.club.name} description="This removes every active Membership and cannot be undone from the Club UI. Clubs with Session history cannot be deleted." label="Delete Club" title="Delete this Club?" />
  );
  return (
    <section aria-labelledby="club-danger-title" className={`${styles.card} ${styles.dangerZone}`}>
      <h2 id="club-danger-title">Danger Zone</h2>
      {isAdmin ? (
        <>
          <div className={styles.dangerActions}>
            {active ? <ManageModerators projection={projection} /> : null}
            {active ? (
              <ConfirmAction action="archive" clubId={clubId} confirmation="ARCHIVE" description="The Club becomes read-only until you reactivate it. Members keep access to its history." label="Archive Club" title="Archive this Club?" />
            ) : <ReactivateAction clubId={clubId} />}
            {deleteAction}
          </div>
          <p className={styles.explanation}>Admins cannot leave their own Club. Delete it while it is empty, or ask the App Admin to transfer it.</p>
        </>
      ) : (
        <>
          <div className={styles.dangerActions}>
            <ConfirmAction action="leave" clubId={clubId} confirmation="LEAVE" description="You will lose access to this private Club. Shared history remains for its members." label="Leave Club" title="Leave this Club?" />
          </div>
          <p className={styles.explanation}>Your Membership ends immediately. Shared Club history remains.</p>
        </>
      )}
    </section>
  );
}

export function ClubSettings({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
  const active = projection.club.lifecycle === "ACTIVE";
  const role = projection.club.membershipRole;
  const roleLabel = role === "ADMIN" ? "Admin" : role === "MODERATOR" ? "Moderator" : "Member";
  return (
    <main className={styles.layout}>
      <header className={styles.hero}>
        <h1>{projection.club.name}</h1>
        <p className={styles.meta}>
          <span>{projection.members.length} of {projection.entitlements.memberLimit} members</span>
          <span aria-hidden="true" className={styles.sep}>·</span>
          <span>{projection.club.tier === "FREE" ? "Free" : "Pro"} Club</span>
          <span aria-hidden="true" className={styles.sep}>·</span>
          <span>You are {roleLabel}</span>
          {!active ? <><span aria-hidden="true" className={styles.sep}>·</span><span className={styles.archived}>Archived</span></> : null}
        </p>
      </header>

      <nav aria-label="Club sections" className={styles.tabs}>
        {clubNavigation(projection.club.id, "manage").map((item) => (
          <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>{item.label}</a>
        ))}
      </nav>

      {role !== "ADMIN" ? (
        <p className={styles.notice}>You can review this Club&apos;s settings. Only the Club Admin can change them.</p>
      ) : null}
      {!active ? <p className={styles.notice}>This Club is archived. History remains visible, but ordinary changes are paused.</p> : null}

      <div className={styles.grid}>
        <ClubInfoCard projection={projection} />
        <VisibilityCard projection={projection} />
        <AvatarCard projection={projection} />
        <DangerZone projection={projection} />
      </div>
    </main>
  );
}
