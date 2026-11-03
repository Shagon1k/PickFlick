# Phase 18 — Human Verification & Bug Fixing III

This phase runs [Roadmap Phase 18](../ROADMAP.md#phase-18--human-verification--bug-fixing-iii--in-progress)
under [#63](https://github.com/Shagon1k/PickFlick/issues/63) on branch `PF-18-1_verify`. The owner
reports findings from local multi-user testing in batches. Nothing is fixed until the owner says
to start.

## Severity

- **Blocker**: a core flow cannot finish, or data, security or privacy is at risk.
- **Major**: a flow behaves wrongly or misleads, or a delivered surface clearly departs from the
  canonical design.
- **Minor**: the flow works but looks or reads wrong.
- **Cosmetic**: polish only.

## Kinds

- **Bug**: behavior is wrong against the rules or the code's own intent.
- **Design**: the surface departs from the canonical prototype; fix toward the prototype.
- **Options**: the prototypes do not cover it. Propose three distinct options and wait for the
  owner's choice before building.
- **Decision**: a product rule changes or is undecided; record it in the Roadmap Decision Log.
- **Check**: possibly expected behavior; confirm before treating it as a defect.

## Cross-cutting rules from the owner

- **X1 — Less explanatory copy.** Move secondary explanations into an info (i) popover based on the
  existing poster info popover, made smaller. `InfoTip` now shows the poster's italic "i" (`cf70c3e`). Placement must keep the composition; never beside a
  page or dialog title by default.
- **X2 — No part-width buttons.** A button that fills part of a row and leaves empty space beside it
  is wrong. Use full-width or equal-split actions where the layout is a column.
- **X3 — Local time.** Show times in the viewer's time zone through `Intl`, without a "UTC" suffix.
  Done in `9093e4b`: moments render through `LocalTime`; Session days stay calendar dates.
- **Star rows.** Ten rating stars share one row and narrow to fit phones (at least 24px wide,
  44px tall) instead of scrolling sideways, as the prototype's 28px stars do. This trades the
  44px width target for the owner's no-horizontal-scroll rule.
- **X4 — Silent success.** Visible confirmations such as "Watchlist saved." or "Recent invitations
  loaded." go; announcements stay for assistive technology.

## Design options

Three directions for each design gap (#1, 2, 4, 5, 7, 12, 18, 22, 24, 27, 30–32, 71) are published for
the owner as a private artifact: <https://claude.ai/artifact/EchxZVXUHaoQPdpmgHAJkF>. The choices
below were implemented in this branch. #12 also had a bug (the strip's tab when opening upward), fixed in `69cc602`.

## Register

| #   | Surface                                | Finding                                                                                                                                                                                                                              | Kind            | Severity | Status                     |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | -------- | -------------------------- |
| 1   | Login, Google button                   | The Google mark looks crude. Keep it monochrome but closer to the real mark.                                                                                                                                                         | Options         | Minor    | Fixed `eb94257`            |
| 2   | Club settings, Invite dialog           | Too much copy; lifetime text goes to X1. Recent invitations and the actions read as unrelated pieces. Recompose the dialog.                                                                                                          | Options, X1, X2 | Major    | Fixed `6da0735`            |
| 3   | Mobile nav, Club Hub switcher          | The switcher lists different Clubs on different pages; it must show the same list everywhere it is available. Its icon is odd.                                                                                                       | Bug, Options    | Major    | Fixed `f52346e`            |
| 4   | Invitation unavailable                 | Large empty box with only "Your choice stays private."; the only action looks like text until hovered. Recompose the edge state in the style of the invited card.                                                                    | Options         | Major    | Fixed `1a31bdb`            |
| 5   | Manage Moderators                      | Rows wrap awkwardly. Replace per-row "Save role" with one Save at the bottom, enabled only when something changed.                                                                                                                   | Options         | Major    | Fixed `958067b`            |
| 6   | Notifications popover                  | An item is marked read only by clicking its dot, not by clicking the item. Recheck the popover against the prototype.                                                                                                                | Bug, Design     | Major    | Fixed `c1986ad`            |
| 7   | Schedule a Session, success state      | Empty space and part-width buttons; the link explanation goes to X1.                                                                                                                                                                 | Options, X1, X2 | Minor    | Fixed `0c72e57`            |
| 8   | Session, Nomination status banner      | Shows "0 of 0 participants have nominated." The refresh control is misaligned and may be unnecessary when the Session updates live.                                                                                                  | Bug             | Major    | Fixed `d7e0781`            |
| 9   | Pending invites, Session invite        | Accept joins the Session but the panel does not change and shows "The response could not be confirmed…". The error, when real, sits at the top in plain text. Row layout leaves empty space before the actions.                      | Bug, X2         | Major    | Fixed `30ca149`            |
| 10  | Selection ballot                       | The scoring instruction goes to X1.                                                                                                                                                                                                  | Design, X1      | Minor    | Fixed `bf82c6a`            |
| 11  | Selection results                      | Not the prototype's "Nomination Rivals" block; extra copy.                                                                                                                                                                           | Design, X1      | Major    | Fixed `069db28`            |
| 12  | Session actions filmstrip              | The `>` icon for the next phase is too casual. When the strip opens upward, its notch must sit at the bottom.                                                                                                                        | Options, Bug    | Minor    | Fixed `f495641`            |
| 13  | Session Rating form                    | Not the prototype; redundant "8 of 10", "Rate this screening" and two rule sentences.                                                                                                                                                | Design, X1      | Major    | Fixed `54a96cb`            |
| 14  | Library statistics                     | The paragraph under the cards goes to X1; the sections below do not match the prototype.                                                                                                                                             | Design, X1      | Major    | Fixed `147563f`            |
| 15  | Movie Details, Personal Rating popover | Far larger than the prototype's compact popover. Use the prototype and check it on narrow phones.                                                                                                                                    | Design          | Major    | Fixed `f8a4170`            |
| 16  | Completed Session header               | Invite is offered after completion, although joining is described as closing at completion. Review Invite for every phase.                                                                                                           | Bug             | Major    | Fixed `b10ef74`            |
| 17  | Movie Details, rating ticket           | The ticket shape is approved; the "8/10" text and its icon do not match the prototype.                                                                                                                                               | Design          | Minor    | Fixed `f8a4170`            |
| 18  | Watchlist priority popover             | "Watchlist saved." is noise (X4); the popover is bulky and "Remove from watchlist" reads as text. Rethink it, possibly as minimal as the Rating popover.                                                                             | Options, X4     | Minor    | Fixed `e29b0e0`            |
| 19  | Pending invites ticket                 | The ticket appears only after a reload, keeps its buttons after Accept, and does not update or hide at 0. Add a slide-in and slide-out from the screen edge.                                                                         | Bug             | Major    | Fixed `30ca149`            |
| 20  | Selection complete card                | Not the prototype and too long. "UTC" timestamps here and elsewhere go to X3.                                                                                                                                                        | Design, X3      | Major    | Fixed `069db28`            |
| 21  | Club Hub, Active Ratings               | Not the prototype. The filmstrip progress must keep frame proportions by showing fewer frames on narrow widths.                                                                                                                      | Design          | Major    | Fixed `75defbf`            |
| 22  | Session Rating, submitted state        | "Your rating is saved", the large score and Individual Ratings take too much space and repeat copy. Use the prototype; propose a layout if it has none.                                                                              | Design, Options | Major    | Fixed `3675176`            |
| 23  | Completed Session, Nomination Rivals   | Not the prototype; the vote breakdown disclosure looks broken. Times show "UTC" (X3).                                                                                                                                                | Design, X3      | Major    | Fixed `069db28`            |
| 24  | Footer, mobile                         | Too tall. Drop the tagline; place the links beside the wordmark if they fit.                                                                                                                                                         | Options         | Minor    | Fixed `8e370b2`            |
| 25  | Club Hub, empty call sheet             | The explanatory sentence goes to X1; the button is part-width (X2).                                                                                                                                                                  | X1, X2          | Minor    | Fixed `fdb5352`            |
| 26  | Club Hub Overview, activity            | Recent Activity is less informative than the prototype and looks different. "Session history" repeats the Sessions tab and goes.                                                                                                     | Design          | Major    | Fixed `e48cbb3`, `7e3ff67` |
| 27  | Club Hub Sessions tab                  | "Active Sessions" and "Active Session" are near-duplicate headings absent from the prototype. Keep Log a Past Session and Create Session together, more minimal.                                                                     | Options         | Major    | Fixed `d3bccb0`            |
| 28  | Achievements cards (Hub and Library)   | Not the prototype; achievement icons are missing. Swap the Unlocked and In progress colors. Hide the "v1" rule version; "How this is calculated" goes to a popover. Align rows: one-line title, description reserved at three lines. | Design, X1      | Major    | Fixed `c1728e3`            |
| 29  | Achievements summary filters           | Not the prototype; no hover or pressed state.                                                                                                                                                                                        | Design          | Minor    | Fixed `c1728e3`            |
| 30  | Log a Past Session dialog              | Too complex for its value; rethink it, even beyond the prototype. "Remove selected Movie" is long and reads as text. The selected Movie should be a nominee by default; optional sections need a cleaner reveal.                     | Options         | Major    | Fixed `9ac4a79`            |
| 31  | Log a Past Session, attendees          | The star scale overflows horizontally on mobile. "optional" labels repeat everywhere. Attendee pills look crude.                                                                                                                     | Bug, Options    | Major    | Fixed `9ac4a79`            |
| 32  | Log a Past Session, attendee rating    | Purpose of "Clear rating" is unclear; "8 of 10" repeats the stars.                                                                                                                                                                   | Options         | Minor    | Fixed `9ac4a79`            |
| 33  | Log a Past Session, nominations        | The second nomination row lays out side by side and breaks the form.                                                                                                                                                                 | Bug             | Major    | Fixed `d3ee04e`            |
| 34  | Log a Past Session, scores table       | Selects are too wide, the arrow touches the border, and the table scrolls far horizontally.                                                                                                                                          | Bug             | Major    | Fixed `d3ee04e`            |
| 35  | Log a Past Session, copy               | Explanatory paragraphs go to X1.                                                                                                                                                                                                     | X1              | Minor    | Fixed `d3ee04e`            |
| 36  | Club switch, mobile                    | The page scrolls down at random after changing Club.                                                                                                                                                                                 | Bug             | Minor    | Fixed `e3464bf`            |
| 37  | Schedule a Session                     | A Session can be scheduled in the past; local data has Sessions dated 1995.                                                                                                                                                          | Bug             | Major    | Fixed `1e558e6`            |
| 38  | Member kicked from a Session           | A kicked member cannot see why they cannot join. Owner decision: they may still see the Session's progress, with a clear mark that they were removed from it.                                                                        | Bug             | Major    | Fixed `918437f`            |
| 39  | Email notifications                    | Expected locally: `RESEND_DELIVERY_MODE=disabled` keeps all 15 email deliveries `PENDING`. Verify sending in UAT.                                                                                                                    | Check           | Minor    | Expected locally           |
| 40  | Hub statistics, Sessions this year     | Shows 0. Likely correct for the data: no local Session is scheduled in 2026 (see #37); confirm.                                                                                                                                      | Check           | Minor    | Confirmed: local data      |
| 41  | Find and nominate a Movie              | "Searching films" and "No films found…" render in the block; show them inside the search popover.                                                                                                                                    | Design          | Minor    | Fixed `4d30db6`            |
| 42  | Plans, Club Ratings                    | Owner decision: Club Ratings are available on every plan, not PRO only. Record it in the Roadmap Decision Log with the fix.                                                                                                          | Decision        | Major    | Fixed `22c0784`            |
| 43  | Club Hub Overview, statistics          | Only "Sessions watched" appears; the prototype shows more.                                                                                                                                                                           | Design          | Major    | Fixed `8dbb4e2`            |
| 44  | Log a Past Session, nominators         | One member can be chosen as nominator for two films; exclude already chosen members from the other selects.                                                                                                                          | Bug             | Minor    | Fixed `d3bc993`            |
| 45  | My Library structure                   | Should mirror the Hub: statistics on top, tabs, and mobile footer navigation between tabs. The Ratings table does not match the prototype.                                                                                           | Design          | Major    | Fixed `bac059a`            |

### Agent review findings

Two read-only review agents checked the code against the rules and prototypes after the owner's
batches. Rows below are new or add to an earlier row; spot-checked items are marked in the finding.

| #   | Surface                         | Finding                                                                                                                                                                                                                                     | Kind           | Severity | Status                     |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | -------------------------- |
| 46  | Session roster, rejoining       | A member who leaves and rejoins the Club gets a new Membership, so they can join an open Session again and submit a second ballot or Session Rating. Verified in `session-roster.service.ts`: participation is keyed by the new Membership. | Bug            | Major    | Fixed `918437f`            |
| 47  | Live attendance                 | Live Sessions never record `attended`; only Log a Past Session does. Attendance achievements cannot be earned live, and live screenings break attendance runs.                                                                              | Decision       | Major    | Fixed `e0a5b43`            |
| 48  | Evening and night achievements  | Session dates are date-only, so Double Feature, Marathon Night and Night Owl can never be earned yet show as reachable goals.                                                                                                               | Decision       | Major    | Fixed `e6dde15`            |
| 49  | Nomination auto-advance         | The creator is not a participant; if the first joiner nominates at once, 1 of 1 nominated advances straight to Watching before others can join.                                                                                             | Decision       | Major    | Fixed `47e7caf`            |
| 50  | Club Hub live updates           | The Hub and its tabs never refresh after another member's change; only the bell and the Session page are live. A Moderator can reach Create Session and fail with the blocking error.                                                       | Bug            | Major    | Fixed `a03e4f0`            |
| 51  | Cancel in Rating                | Cancel stays available in Rating after ratings arrived; the screening then leaves history, analytics and achievements while Personal Ratings keep the scores.                                                                               | Decision       | Major    | Fixed `90ec212`            |
| 52  | Kick hierarchy                  | A Moderator can kick the Club Admin or another Moderator from a Session; the Admin then cannot rejoin.                                                                                                                                      | Bug            | Minor    | Fixed `bdfd4ee`            |
| 53  | Empty Nomination deadline       | After a deadline passes with no nominations, the header reads "Nomination is closing" forever.                                                                                                                                              | Bug            | Minor    | Fixed `cd988c1`            |
| 54  | Deadline after screening        | The Nomination deadline may fall after the scheduled screening date (adds to #37).                                                                                                                                                          | Bug            | Minor    | Fixed `1e558e6`            |
| 55  | Session link, non-members       | A non-member opening a Session link gets the generic 404 instead of a hint to join the Club.                                                                                                                                                | Bug            | Minor    | Fixed `20a7a1e`            |
| 56  | Roster notifications            | Session invitations, kicks and revoked invites create no notification (adds to #38).                                                                                                                                                        | Decision       | Minor    | Fixed `d5c9f33`            |
| 57  | Club link after inviter removal | A Club link stays valid after its creator is removed or demoted; Session invites already check this.                                                                                                                                        | Check          | Minor    | Fixed `4add418`            |
| 58  | Achievement awards              | Awards and their notifications are written only when someone opens an achievements view.                                                                                                                                                    | Check          | Minor    | Accepted as designed       |
| 59  | Self notifications              | The actor is notified of their own action, such as creating a Session.                                                                                                                                                                      | Check          | Cosmetic | Fixed `924a32f`            |
| 60  | Rating Sessions for new members | Every open Rating Session appears as a pending invite to newly joined members, who can rate screenings held before they joined.                                                                                                             | Decision       | Minor    | Fixed `b99a50f`            |
| 61  | Past Session date east of UTC   | Log a Past Session rejects "today" after local midnight east of UTC.                                                                                                                                                                        | Bug            | Minor    | Fixed `c83da64`            |
| 62  | Account and Settings links      | Settings, Privacy & data, Profile, Notifications, Subscription and Join a Club lead to routes that do not exist yet. Hide them until their phase.                                                                                           | Bug            | Major    | Fixed `4667404`, `b6301ab` |
| 63  | Session invitation page         | Bare meta lines, "UTC", labels unlike the Club invitation, part-width actions, three-sentence unavailable copy.                                                                                                                             | Design, X1, X2 | Minor    | Fixed `48a6994`            |
| 64  | Session phase banners           | Banner copy drifts from the prototypes in every phase; Watching drops "N of M".                                                                                                                                                             | Design, X1     | Minor    | Fixed `e5786e5`            |
| 65  | Hub rule narration              | Policy and rule paragraphs on Overview, Sessions, Ratings, Members, Achievements, Danger Zone and Club status banners (adds to #26, #27, #28, #43).                                                                                         | X1             | Minor    | Fixed `6ca3bc2`            |
| 66  | Duplicate empty state           | The Call Sheet and the Active Session card both state "no Session" with two buttons for one action (adds to #25, #27).                                                                                                                      | X1, X2         | Minor    | Fixed `fdb5352`            |
| 67  | Manage Club Session controls    | The prototype's Create and Log past Session row is missing from Manage Club (adds to #27).                                                                                                                                                  | Design, X2     | Minor    | Fixed `d3bccb0`            |
| 68  | Members tab                     | "+ Invite" goes to Manage Club instead of opening the dialog; extra role paragraph; visible removal confirmation.                                                                                                                           | Design, X1, X4 | Minor    | Fixed `6da0735`            |
| 69  | Delete Club                     | Offered to Admins of Clubs with Session history, who type the full name only to get `SESSION_HISTORY`.                                                                                                                                      | Bug            | Minor    | Fixed `67a61fa`            |
| 70  | Visible success messages        | Nomination, Selection, Personal Rating, Club settings and Log a Past Session confirmations stay on screen.                                                                                                                                  | X4             | Minor    | Fixed `e0855e2`            |
| 71  | Imported Completed Session      | The view is mostly disclaimers about unknown data.                                                                                                                                                                                          | X1, Options    | Minor    | Fixed `9862add`            |
| 72  | Rating panel without a rating   | "Your rating" renders only notices when the viewer did not rate (adds to #22).                                                                                                                                                              | X1             | Minor    | Fixed `54a96cb`            |
| 73  | Nomination after submitting     | Two confirmations for one nomination; the prototype shows the faded "by you" card.                                                                                                                                                          | Design, X4     | Minor    | Fixed `1693187`            |
| 74  | Kick dialog                     | Raw lowercase states; removing someone else reuses "Keep participation".                                                                                                                                                                    | Bug            | Minor    | Fixed `14034d3`            |
| 75  | Pricing                         | Public copy mentions "the Paddle billing phase"; the prototype says "Upgrade to Pro".                                                                                                                                                       | Bug            | Minor    | Fixed `22c0784`            |
| 76  | Movie and film naming           | "Movie" and "film" mix, sometimes in one sentence; "Back to Hub" and "Back to your Clubs" lead to the same place.                                                                                                                           | Design         | Cosmetic | Fixed `4cffc83`            |
| 77  | Unavailable fallbacks           | Session, Movie and Log a Past Session failures are bare headings, unlike the shared error composition.                                                                                                                                      | Design         | Minor    | Fixed `4cac49b`            |
| 78  | My Library header and filters   | Tagline replaces the owner line; filters need Apply instead of filtering live with a count (adds to #45).                                                                                                                                   | Design         | Minor    | Fixed `bac059a`            |
| 79  | Deadline field                  | A helper sentence instead of the prototype's "from now" suffix.                                                                                                                                                                             | X1             | Cosmetic | Fixed `3c97661`            |
| 80  | Past Session wizard navigation  | The second Next reused the submit button DOM node and saved before step three.                                                                                                                                                              | Bug            | Major    | Fixed `d3ee04e`            |

## Owner decisions, 2026-10-31

- **Design picks:** 1A (fix the cropped mark), 2A (Recent links redone in round 2), 4B with the
  reason on the stamp (USED, EXPIRED or REVOKED), 5B, 7A, 18C, 22A (one-line reviews, expansion in
  round 2), 24A, 71A, 30–32A. #12 uses the round-2 skip-forward icon; #22 uses the round-2 review popover. #27 keeps the current Sessions
  tab and adds Create and Log past Session to it, moved from Manage Club. #68 "+ Invite" opens
  the 2A dialog.
- **#47** Accepted participants of a Completed live Session count as attended.
- **#48** Sessions get an optional screening time.
- **#49** Automatic advance on "all nominated" needs at least two accepted participants.
- **#51** Cancel is refused once any Session Rating was received.
- **#56** In-app notifications for a targeted Session invitation and for removal from a Session.
- **#60** Members see history and open Rating Sessions, but cannot rate an open Rating Session
  scheduled before they joined the Club.
- **#59** The actor is not notified of their own action.
- **#43** Free Clubs show every Overview statistic; future Pro feature discovery is
  [#200](https://github.com/Shagon1k/PickFlick/issues/200), Deferred in Project 3.
- **#26** Restyle Recent Activity after the prototype; deciding on a privacy-filtered member event
  feed is a Phase 22 subtask in [#81](https://github.com/Shagon1k/PickFlick/issues/81).
- **#58** Awards stay computed when an achievements view opens.
- **#62** Menu entries for unbuilt pages come back and lead to 404 until their phase.
- Unused roster endpoints (A5) go unless a planned phase needs them.

## How the decisions landed

Final verification found and fixed one additional Major: the second Next reused the submit
button's DOM node, so its default click submitted the wizard before step three. `d3ee04e`
prevents that default action and the real-API journey asserts that no Session exists before
Log Session. It also finishes #33–35: separate nomination rows, compact locally scrolling score
cells and assistive-technology-only success announcements.

- **#2, #68.** Opening the invite dialog tears off a fresh link once per page view, so reopening
  does not burn the Club's pending-link limit; "New link" makes another. Recent links fold into one
  row styled like the site's cards. The Members tab "+ Invite" opens the same dialog.
- **#4.** A closed link shows a voided ticket stamped VOID, USED, EXPIRED, REVOKED, FULL, PAUSED or
  DECLINED. A link someone else already used now answers `used` instead of `invalid`; neither
  names the Club.
- **#7.** Scheduling opens the new Session with a one-time "Copy link" toast.
- **#12.** The next-phase action uses a skip-forward icon (round 2, A).
- **#22.** Your rating sits highlighted at the top of the list with a "Final" lock tag; each review
  shows one line and opens in a popover (round 2, B). Entries carry `isOwn`.
- **#27, #67.** The Sessions tab follows the prototype: one Active Sessions list (the running
  Session and every Rating Session) with Schedule and Log a Past Session under it, then History.
  Create Session left Manage Club.
- **#30–32.** Log a Past Session is three steps: film and date, who came with ratings, then
  nominations. The screened film starts as a nominee; tapping the same star clears a rating.
- **#47.** Accepted participants of a completed live Session count as attendees in achievements,
  derived at read time, so existing history needs no backfill.
- **#48.** The screening time is the venue's wall-clock time, stored in the same UTC fields as the
  date, so every member sees the same "8:00 PM" and evening achievements read it directly.
  Limitation: a screening at exactly 00:00 reads as date-only.
- **#56.** Removal from a Session notifies the removed member; Club removal still sends only
  MEMBERSHIP_REMOVED. The targeted-invite notice has no trigger since A5 removed personal Session
  invites, so it was not built.
- **#60.** The rule applies only when the Rating Session has a screening date before the member's
  join date; undated Sessions stay open to everyone who joined them.
- **A5.** Personal Session invite creation, respond-by-ID, `eligibleMembers` and `canInvite` are
  gone; existing token links still preview, answer and revoke.

## Owner alignment round, 2026-11-01

The owner reopened the whole prior request after finding visible departures despite the earlier
green checks. Keep all current alignment work in one commit and provide actual before/after app
screenshots. Passing tests and updating baselines do not establish parity with the source design.
Compare each affected surface with its canonical prototype and retain the recorded owner choices.
Departures need an uncovered case, an important adaptation, or an explicit prior owner decision.

The latest requirements amend the earlier register and X4:

- Remove footer space reserved for a hidden invite ticket; retain clearance while it is visible.
- Automatic Nomination closure requires every active Club member to have joined and nominated,
  with at least two accepted participants. Deadline and manual closure keep their existing rules.
- Reuse temporary animated Saved/Copied feedback inside the existing button, restoring its label
  without changing geometry. The shared default is 1800ms; existing Session Copy flows retain
  their 1500ms lifetime. Other success narration remains assistive-only.
- Keep bookmark hover and opening stable. Watchlist pending and success text stays assistive-only;
  failures remain visible.
- Use the compact rating popover and a single star row. Own and historical ratings have no visible
  N/10 label. Review the complete Session family, including imported rivals, facts and result states.
- Allow scoped real local Resend verification for the owner's approved test addresses, with an
  activation cutoff and `[LOCAL]` subjects. Older notification backlog and operator email alerts
  are excluded. See the [ADR-020 amendment](decisions/README.md#adr-020-amendment--scoped-local-live-verification-2026-11-01).

### Coverage of the original 80 findings

The table maps every original finding to its owning sources and existing assertions. “Assertions”
means checks present in the current tree, not results from this round. Independent source review
covered the shared controls and adjacent flows; that independent review did not run browsers,
tests or delivery. The implementation run subsequently produced the scoped evidence below. Those
results cover the full current automated UI and visual selections; exact-head hosted owner
acceptance remains separate.

| Original IDs                                                               | Source scope and canonical authority                                                                                                                                                                             | Existing assertion locations                                                                                                                                                                                | Current evidence                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4, 6–7, 9, 12, 16, 19, 24, 36, 55, 57, 62–63, 76–77                      | LoginActions, navigation/shell/footer, InviteDialog, both invitation pages, PendingInvites, NotificationItems, SessionHeader; `login.html`, `invite.html`, `app.html`, Session family and selected owner options | `tests/ui/shells.spec.ts`, `interaction.spec.ts`, `club-settings.spec.ts`, `session-roster.spec.ts`; invitation and roster backend integration suites                                                       | Source review, scoped UI checks and database suite; full UI contract and visual gates passed                                           |
| 5, 21, 25–29, 40, 42–43, 50, 58, 65–69, 75                                 | ManageModerators, HubOverview/HubSessions, ActiveSessionCard/ActiveRatings, FilmProgress, ClubRatings, Achievements, HubLiveRefresh; `app.html`, `DESIGN.md`, owner decisions                                    | `tests/ui/club-hub.spec.ts`, `club-settings.spec.ts`, `achievements.spec.ts`, `completed-history.spec.ts`; `tests/journeys/hub-live-refresh.spec.ts`; Club/achievement backend suites                       | Source review; real two-account empty-inbox refresh regression reproduced before/fixed after; full UI contract and visual gates passed |
| 8, 10–11, 13, 20, 22–23, 37–38, 41, 46–49, 51–54, 56, 59–60, 64, 70–74, 79 | SessionDetails/Header/Facts, Nomination/Selection/Rating/Completed, rivals, roster, SessionForm, server completion/access/deadlines; canonical Session family and business rules                                 | `tests/ui/nominations.spec.ts`, `selection.spec.ts`, `watching.spec.ts`, `rating.spec.ts`, `session-workflows.spec.ts`, `completed-history.spec.ts`; Session progress/roster/rating/deadline backend suites | Source review, database suite and scoped UI checks; full UI contract and visual gates passed                                           |
| 14–15, 17–18, 45, 78                                                       | PersonalRating, WatchlistBookmark, LibraryStatistics/Filters/Table, ScaleControl/Popover/Table; `movie-details.html`, `library.html`, chosen 18C and star-row override                                           | `tests/ui/library.spec.ts`, `personal-rating.spec.ts`, `watchlist.spec.ts`; corresponding real-API journeys                                                                                                 | Source review, real-API journeys and bookmark geometry check; full UI contract and visual gates passed                                 |
| 30–35, 44, 61, 80                                                          | PastSessionForm, PastAttendees, PastNominations, MoviePicker and field wrappers; three-step owner choice 30–32A and historical evidence rules                                                                    | `tests/ui/past-session.spec.ts`, `tests/journeys/past-session.spec.ts`; past Session/Selection backend suites                                                                                               | Source review, database suite and real-API journeys including Back/Next title persistence at four widths; visual gate passed           |
| 39                                                                         | Email configuration, shared Resend sender, dispatcher/claim filter; ADR-020 local amendment and email operations guide                                                                                           | Resend client unit suite; email dispatcher/webhook integration suites                                                                                                                                       | Actual producer→queue→worker: 2/2 provider-delivered; 30 prior rows unchanged; local DB ACCEPTED, signed callbacks unverified          |

The current source changes address the reported imported bulleted list, uppercase/clipped InfoTips,
disabled selected-film field, duplicate leaderboard caption, rating denominators, footer spacer and
bookmark movement. The source review also found the Watching banner's missing all-member denominator
and generic Join instructions for viewers who cannot join; current Session changes address these
states. Automated checks supplement source review; owner acceptance remains open.

Intentional exceptions remain: the owner's invitation, moderator, watchlist, rating, footer and
wizard choices; Session actions moved to the Sessions tab; unbuilt menu destinations returning 404;
view-triggered achievements (#58); Pro discovery deferred in #200; member-event feed deferred in #81.
These are dispositions, not missing alignment fixes.

### Current alignment evidence

- Final `PICKFLICK_ENV_FILE=.env.example pnpm verify` passed in the isolated native checkout:
  lint, formatting, knip, type checks, 624 unit tests and builds. The earlier Linux static run
  also passed. The user’s development build stayed available on port 3000.
- Database integration passed 325/325 against isolated `pickflick_test`.
- Real-API journeys passed 17/17. The empty-inbox Hub refresh regression was reproduced before the
  fix and passed afterward with two accounts. Past Session Back/Next retains the selected title
  at 390, 768, 1024 and 1440px.
- The final fresh-mock native UI contract passed 310/310, including keyboard, touch, axe,
  failure states and all four canonical widths. InfoTip preserves its help-text description and
  Escape behavior; Date and Time retain the shared field gap.
- The pinned Linux visual selection passed 112/112 during the update and again without updating
  snapshots. All 49 changed and two new PNGs were inspected; the inventory is 120. Pixel
  tolerance and masks are unchanged.
- Eight actual before/after production-screen pairs were captured at 390×844, DPR 2, using the
  same synthetic fixtures. Before uses frozen `666ea16`; after uses the current implementation.
  The owner report includes an interactive comparison and a portable `before-after.html` artifact
  under the ignored `test-results/alignment-20261101`. Both reviewers inspected all eight pairs;
  a Date/Time gap concern was corrected and rechecked. Captures alone do not establish interaction
  behavior or owner acceptance.
- Real local email traversed the actual Session producer, notification queue and email worker.
  At 2026-11-01 13:11 UTC, provider GET responses showed `last_event=delivered` for both sends
  (2/2). The database remains `ACCEPTED` because local signed webhooks were not configured;
  provider delivery was verified separately. Private `local-email-proof.json` records safe IDs
  and outcomes without addresses or credentials and is not committed.
- All 30 pre-existing delivery rows remained byte-for-byte unchanged. The temporary QA Club,
  synthetic actor and test notices were removed. `SESSION_STARTED` email is enabled for both
  approved accounts; other preferences are unchanged. Scoped local delivery remains live.

The first hosted PR visual run found one nondeterministic capture: the pointer left by opening
Invite could hover New link after the modal moved beneath it. All 636 differing pixels were that
button's hover border; the parallel full hosted visual selection passed. The capture now moves the
pointer away before settling, as the Moderator capture already does. Baselines, masks and pixel
tolerance are unchanged. Both dialog widths pass three pinned-Linux repeats (6/6), without retries or baseline updates.

The subsequent hosted smoke/full selections found two additional readiness gaps in tests:
Date/Time geometry was sampled before the streamed fields became visible, and Hub was clicked
before the mobile menu's layout effect attached its alignment. Both now wait for those observable
states before measuring or clicking. The exact gap, dropdown geometry, six navigation labels and
Sessions destination assertions remain unchanged. Three repeats at both picker widths plus Hub
navigation pass 9/9 in pinned Linux, without retries.

A real-API journey also opened the Admin menu while the member's nomination response was still
in flight. Its trace showed transient menu detachment, not clipping or a persistent positioning
loop. It now waits for the persisted Your pick link, then settles the reloaded Admin page before
opening settings. Three focused real journeys pass. The unchanged journey also passed locally,
so a production defect was not established; these changes synchronize tests without changing UI,
timeouts, click forcing, baselines or comparison tolerances.

The broader local smoke run also exposed a Watchlist test clicking the old Library priority
button before navigation to Movie completed. It now waits for the Movie URL and scopes the
bookmark to that Movie's region; unique fixture tokens isolate repeated runs. Priority, removal
and focus assertions remain intact. A parallel local run also missed Nomination's fixed 5500ms
fault window against its 5000ms poll; all three repeats with CI's configured single worker pass.
The fixture timing and the application remain unchanged. The final native smoke selection passes
113/113 with the configured single worker, including all four Watchlist widths.

Exact-head hosted CI, owner acceptance and deployed-environment verification remain separate gates.

## Baseline verification at `666ea16`, 2026-11-01

The following results predate the reopened alignment round. They describe the baseline revision,
not the current worktree, its design parity or its live delivery behavior.

- `PICKFLICK_ENV_FILE=.env.example pnpm verify`: lint, knip, formatting, type checks, 609 unit
  tests and production builds pass.
- Database integration: 320/320 on isolated `pickflick_test`, with email delivery disabled.
- Real-API journeys: 16/16. The final Past Session rerun passes 6/6, including the explicit
  no-creation-before-submit assertion, retry preservation, partial evidence, axe, keyboard/touch
  and 390/768/1024/1440 widths.
- Five previously failing UI checks pass in the pinned Linux image after selectors and
  hydration/animation waits match the delivered interface.
- The full Linux UI run passes 400/402. Its two remaining timing-sensitive checks are repaired:
  filter taps wait for each pressed-state change, and dialog captures wait for the previous
  overlay to close and remove pointer hover. All six affected responsive cases then pass three
  repeats (18/18) without retries. Full CI contract and visual checks gate the final committed head.
- Baselines: 62 changed and ten new PNGs, all inspected; the two final Moderator updates were
  inspected again. Pixel tolerance and masking rules are unchanged.
- `pnpm deploy:check`: local, UAT and production definitions render. No deployment is performed.

At this baseline, live email delivery (#39) and two-account Hub refresh were still outstanding;
their later local evidence appears above. The phase remains open for exact-head
hosted owner acceptance. Local observations do not establish UAT results. Keep this register until
the gate closes.

## Owner case-by-case follow-up

Changes in this round remain uncommitted. The owner defers writing and running tests until all
cases are finished. Screenshots are now provided only when the owner explicitly asks.

- Overview keeps the canonical Active Session card beside Members even when no Session is active.
  In that empty card, eligible Admins/Moderators get icon-labelled Schedule New and Log Past
  buttons in one row. Other members see only "No active Session." Active Session progress and its existing action
  retain the prototype composition. Automated verification is deferred at the owner's request.

    Actual local-dev screenshots were captured for Admin and Moderator empty states, with desktop
    and mobile compositions. The Member-only copy branch is implemented; its automated verification
    remains deferred with the rest of the cases. Evidence: ignored
    `test-results/cases/case-01-active-session/`.

- Empty Call Sheet uses the selected "action in the header" proposal: compact ghost Schedule New
  beside the phase metadata. On phones, the redundant Current phase / none metadata is hidden
  so Call sheet and Schedule New remain on one header row. The large creation
  button below the title is removed. The action retains the existing scheduling permission;
  the active Session Call Sheet, its content and click target are unchanged. Tests and screenshots
  are deferred as requested.

- Club switching uses the selected clean-arrow proposal: larger full-shaft arrows, no circular
  backing or idle opacity fade, 48px targets and restrained hover/focus feedback. Existing carousel
  order, create-club slot, mobile dots and swipe behavior are retained. Tests remain deferred.

- Leaving Create new club for another Club keeps the create slot visible until the destination
  Club frame mounts; it no longer briefly reveals the previously loaded Club. Frames are keyed
  by Club ID while section switches within a Club retain the persistent frame. Both switcher
  presentations share one grid slot and contribute to its height, avoiding the create-card
  padding/height jump. The hidden creation link is inert and does not prefetch. Tests remain deferred.

- Sessions visual alignment restores body-font section headings (600), canonical row/poster
  spacing and hover expansion without moving content, and neutral display-serif aggregate scores.
  The extra Club score caption is removed; missing/hidden scores still use a dash and Cancelled
  stays a status. Open-session organization follows the chosen Open Ratings plus History layout. Tests remain deferred.

- Selected Sessions layout: omit the Open Ratings section entirely at zero, remove the Rating pill,
  and keep the blocking Session in the Call Sheet. History starts with ten server-projected records
  and Load More appends ten using a Club-scoped cursor, including older records beyond the former
  twenty-row limit. The counter describes loaded records rather than a mismatched Completed-only
  total. Loaded pages survive ordinary live refreshes; role changes reset them, and denied reads
  clear the history before authoritative recovery. Log Past remains accessible to eligible operators.
- Reusable AvatarGroup shows at most five accepted participants and `+N`, with native image/initials
  fallback, grayscale/restored hover color, a 44px trigger and compact full-list popover. Rating rows
  position it left of a 32px film strip at narrow widths. From 1024px the strip moves into a separate
  right column, vertically centered and up to 320px wide. Borders remain between adjacent rows,
  without a trailing bottom line before the section separator. Participant photos use an
  authenticated same-origin proxy; only the existing Google photo host is supported. Other sources
  use initials. No individual scores/submission flags are added.
- All tests, test-fixture updates, lint/typecheck suites and screenshot baselines remain deferred
  until the owner ends this case-by-case round. In particular, typed Hub fixtures will need the
  new historyNextCursor field and future checks must cover paging, role/access changes, roster
  privacy, avatar-download boundaries and nested-interaction behavior. No commit has been made.
- Compact Schedule New (Call Sheet) and Log Past (History) now use a shared subtle Button variant
  instead of muted ghost text: semibold foreground labels, existing calendar/clock icons, no resting
  border or underline, soft hover/focus fill and 44px targets. Both retain link semantics; the
  Overview's existing outlined actions are unchanged. Checks remain deferred for this case.
- Club Ratings, My Ratings and Watchlist remove sort/filter dropdowns, center a shared 480px title
  search and sort through vertically centered headers. The click cycle is ASC, DESC, reset; another
  header resets an active sort. Search/sort start at page one, keep URL state and apply before server
  pagination. Club title search, Year/Genre ordering and explicit directions extend the query contract;
  Library Genre uses paged SQL IDs and existing row projections rather than loading the whole list.
  The API still supports existing exact score/priority links, with a Clear filters recovery action.
  Previous/Next now use clean Club-switcher arrows. The duplicate Active Ratings card is removed
  from Overview; Sessions and Manage Club retain access to open Ratings.
- The header now displays the stored Google profile photo, with grayscale/restored interaction color
  and initials during loading/failure. Authenticated `/account/avatar` reads the current user's image
  only and shares the existing bounded Google downloader with participant avatars. Current target
  dimensions and account-menu semantics are retained; no CSP, dependency or configuration change.
  Tests, checks, screenshot baselines and commit remain deferred until the owner finishes the round.
- Single-section tabs omit duplicate visible titles: Club Members/Achievements and Library
  My Ratings/Watchlist/Achievements. The existing headings stay visually hidden for section naming
  and focus return after edits/removal. Members keeps its right-aligned Invite action and omits the
  action row for viewers who cannot invite. Tests/checks and commit remain deferred.
- Tab spacing now belongs to SectionTabs' common panel wrapper: 32px (`--gap-lg`) to the first
  element across all six Club Hub and three Library tabs, including mobile composition and
  loading/error content. Removed Members' local top margin, Achievements' filter-row top margin,
  and Manage Club's responsive top padding; other panel layouts keep their internal spacing.
  Automated tests/checks and commit remain deferred; manual browser measurements are recorded below.
- Manual spacing verification (2026-11-02, local dev): all six Club Hub panels (Overview, Sessions,
  Ratings, Members, Achievements, Manage Club) and all three Library panels (My Ratings, Watchlist,
  Achievements) measure exactly 32px to their first visible element at 390, 768 and 1440px: 27/27
  measurements. On phones the baseline is the panel start because top tabs are hidden. Rapid
  navigation temporarily reached the existing auth request limit; the affected Library reads were
  repeated successfully after recovery without changing the limit. No screenshots or test suites ran.
- Fixed horizontal document overflow reported in mobile Club Ratings. Two sources contributed:
  the hidden invite widget's negative right offset, and absolutely positioned screen-reader sort
  labels whose containing block escaped the table scroll region. The widget clip now remains at
  right zero while only the ticket translates; the shared table scroll container is positioned.
  No global overflow hiding was added. Manual browser checks: Club Ratings at 320/390/768/1440px
  and My Ratings/Watchlist at 390px have document width equal to viewport client width. The table
  still scrolls locally while window scrollX stays zero. Shown/open invitation states and automated
  regression coverage remain for the deferred test round; no screenshots, tests or commit made.
- Owner checkpoint (2026-11-04): owner requested committing the current skeleton/parity, content
  loader, notification-header and Edit Session spacing work before continuing. Save the current
  source and documentation together; the commit hash is recorded in #63. Browser/tests and
  lint/typecheck/build gates remain deferred. Commit-hook quality automation is skipped under
  that instruction; the staged secret scan runs separately before the checkpoint commit.
- Bare content-loader cleanup (2026-11-04): Log a Past Session no longer shows Loading Club
  history and attendees. Its fallback reuses the actual scene/brand/card/lead, step bars and
  first-step field/action styles. Shared TextInput/Textarea isLoading modes paint Skeleton over
  the actual native control through getFieldProps, retaining label/help geometry; the existing
  Rating form skeleton also uses this path instead of a bespoke textarea overlay.
  Found and replaced two analogous bare loaders: related Movie cards (actual responsive grid,
  poster geometry and known result count) and initial notifications (three actual-styled rows).
  Loading text stays in hidden live statuses. Invitation checking and action-button/live status
  copy remain purposeful states. Log Session still reads authorized Club data, then current/former
  members behind manageSessions; Create Club only checks authentication before its local form.
  No data-fetch order, permission or mutation change. Source review/formatting only; browser/tests
  and other deferred checks remain pending, no real notifications read or Session writes/commit.
- Edit Session empty footer spacing (2026-11-04): the shared Modal already supplies its standard
  32px body-bottom padding. The form's empty live-status paragraph added a 20px minimum plus a
  paragraph top margin below Cancel/Save. Edit-only :empty styling now removes that height/margin
  while leaving the node mounted and non-empty feedback unchanged. No shared Modal geometry or
  save/focus logic changes. Source review/formatting only; browser/automated checks deferred.
- Notification header compactness (2026-11-04): Mark all as read now uses shared ghost/compact
  Button (28px visual height, 11px text, extended 44px vertical hit area). Replace the second-line
  unread summary with a 22px gold-toned badge beside Notifications, visually capped at 99+; keep
  the full count/caught-up announcement in a hidden live status. Hide the badge at zero. Header
  padding is 12px vertically/16px horizontally. Removed native-header button/blanket span styling
  so shared hover/focus/disabled feedback and the status utility keep their own behavior.
  Read handler, pending disable and focus-before-read are unchanged. Source review/formatting
  only; no notification read mutation, browser/automated checks or commit during this follow-up.
- Owner-approved skeleton parity audit fixes (2026-11-04): corrected all ten reported groups.
  Achievement shelf columns/medal/card/description/progress geometry now follows its live rules;
  Overview sections, cards and divider use real spacing; both statistic variants stay horizontal
  on phones with their own glyph/value/label sizing and minimum heights. Members rows use real
  gaps, count slots and known removal space. Sessions rows use the real poster/inset/metadata
  geometry, avatar groups and compact progress; authorized snapshot text reserves actual wrapping.
  Tables now render through Table itself (5 Club / 6 Library columns, no posters, local scrolling,
  count line and arrow/page/arrow pagination). Manage Club has its session summaries and distinct
  Info, checkbox/range, Members and Danger structures with the proper grid breakpoints.
  Added a read-only Hub loading context from the existing frame snapshot; no new request/cache.
  MovieMedia/MoviePoster/TicketPoster now accept explicit loading views using the same layout;
  movie/session headers reuse the live host/ticket classes. Removed the separate legacy film
  skeleton. Nomination, Selection, rating forms/results, rivals and facts have optional loading
  modes which preserve their normal markup/CSS and already-authorized conditional states.
  Shared Skeleton paint uses a Mantine Box span and optionally measures supplied text invisibly;
  known titles, author/genre strings and saved values retain actual line wrapping. Loading content
  is inert. Scale and avatar loading preserve the real target/frame dimensions. Session fallback
  now receives the full authorized Session, uses its true scale/submission/visibility state,
  retains the actual reel break/heading/facts layout and a single Cancelled facts card.
  Source comparison and formatting only; frontend HTTP 200 / backend ready. No browser, tests,
  lint/typecheck/build suites, fixture/baseline edits, data writes or new commits. All new skeleton
  work remains after pushed checkpoint 0ed6489c. Visual/runtime parity still needs the deferred pass.
- Achievement-filter skeleton sizing (2026-11-03): replace generic 100px cards with the live
  summary's column layout, 24px vertical/20px horizontal padding and 8px inner gap. Reserve the
  responsive display-counter line via --fs-app-title × --lh-title and the 14px label's line box.
  Match the four-to-two-column breakpoint at 576px (previous skeleton switched at 768px).
  Follow-up: use 32px --gap-lg between filters and shelf instead of the generic 20px stack gap.
  Source review/formatting only; browser/automated checks remain deferred.
- Phase-aware Session skeletons / Members correction (2026-11-03): removed the Members top-action
  placeholder and unused toolbar CSS. Added route-local SessionLoading compositions from shared
  Skeleton primitives for Nomination, Selection, Watching, Rating, Completed/Logged and Cancelled.
  Unknown phase uses a neutral heading instead of a film layout. SessionPage first reads the
  authorized Session, then a nested Suspense fallback receives its real phase/Club while roster,
  film and request time load in parallel. Auth/denial/recovery rendering is shared between both
  fetch stages; missing-film recovery and progress-version handling remain existing. No client
  phase cache, fixture data or extra API endpoint. Initial roster fetch now starts after Session
  resolves so phase is available to the nested boundary.
  Source/phase coverage reviewed and targeted formatting applied; frontend HTTP 200 / API ready.
  Browser/tests/lint/typecheck/build suites remain deferred. These skeleton changes are still
  working-tree changes after checkpoint 0ed6489c; no commit or data write in this follow-up.
- Owner checkpoint saved/pushed (2026-11-03): split the existing work into 2b1a9981 (backend,
  contracts and database), 99273ee7 (frontend) and 0ed6489c (documentation/consolidation), pushed
  through head 0ed6489ccbe4e72f003ea046b2254b134b68483e to PF-18-1_verify / PR #199. Each staged
  group passed redacted gitleaks scanning. Owner explicitly deferred tests/quality checks; Husky's
  lint/format automation was skipped for these checkpoint commits to preserve the current source.
  SSH authentication failed, but the existing gh HTTPS credentials had push permission and the
  HTTPS push succeeded. No merge or production action was requested or performed.
- Profiled skeletons (2026-11-03): added shared Mantine-backed Skeleton primitives for text,
  title, avatar, poster, control and block; shimmer/tone/reduced-motion behavior lives in its CSS.
  LoadingState composes them into Overview/statistics, Sessions/history, Ratings/Watchlist tables,
  Members, Achievements and Settings profiles. Six Hub loading boundaries now target their actual
  sections. Library initial loading reads the target query tab; keyed panel Suspense and separate
  statistics Suspense provide the corresponding profile during query-tab content streaming.
  Existing film/line and search skeletons now use the same primitive while retaining their source
  dimensions, counts, radii and original default/search shimmer. Removed the unused generic card
  fallback and duplicate paint/keyframes. No dependency, data or permission changes.
  Source/route coverage reviewed and targeted formatting applied; frontend HTTP 200 and API ready.
  Browser/automated checks, screenshot baselines and test edits remain deferred. These new skeleton
  changes are after the checkpoint above and remain in the working tree.
- Sessions desktop row insets (2026-11-03): shared HubSessions row adds 20px horizontal padding
  from 1024px, covering Open Ratings and History. Compact/mobile edge spacing stays unchanged.
  Source review/formatting only; browser/automated checks remain deferred.
- Overview Members avatars (2026-11-03): replace monogram-only content with shared Avatar using
  the already-authorized member.avatarUrl, existing 28px frames and shared image/initials fallback.
  Disable ColorReveal and scope the ordinary avatar filter to grayscale(1), including hover.
  Names/admin labels and the full Members tab's hover-to-color behavior remain unchanged.
  Source review/formatting only; browser/automated checks remain deferred.
- History attendee line (2026-11-03): attendee count now uses a separate span below date/location
  at every width, reusing the copy grid's existing metadata styling. No count/data changes.
  Source review and formatting only; browser/automated checks remain deferred.
- History phone score placement (2026-11-03): removed the mobile full-row placement of score and
  Cancelled. History retains three columns below 576px, with a 56px poster track, flexible text,
  intrinsic right-side score and a 12px column gap. Existing Open Ratings-specific responsive
  grid overrides remain separate. Metadata wraps inside its existing min-width:0 copy block.
  Source reviewed and formatted only; browser/automated checks remain deferred in the owner round.
- Shared Nomination/Rivals cards (2026-11-03, owner-approved after before/after mockups): added
  shared NominationMovieCard and NominationMovieList, replacing the local NominationMovieCard
  and RivalCard plus duplicate layout CSS. Current/own nominations, live ranking, imported
  totals and author-only Rivals all use them. Lists place an intrinsic 1fr-row grid inside a
  bounded 300px scroller, equalizing each list to its tallest card without JS measurement or
  fixed/clipped content. Preserve the 112px minimum and Nomination's three-genre/Rivals' full-genre
  behavior. Poster centers vertically; text remains one block with 4px gaps and 12px by-credit.
  Total/avg use a separate right slot on phones and desktop, with common 24px/400 display-font
  numerals and a 52px avg. target. Whole-card native Movie links exclude only the live score
  button, retaining the existing popover/author/count/privacy behavior and ColorReveal. Logged
  screened-film badge now reads Watched, independently of totals/winner. Selection is unchanged.
  Source review and targeted formatting only; frontend HTTP 200 and backend readiness are up.
  Browser/automated suites and fixture/baseline/test edits remain deferred in the owner round.
  Deferred copy assertions still expect Screened Movie in tests/ui/completed-history.spec.ts:25
  and tests/journeys/past-session.spec.ts:400; update to Watched with the later test pass. No data
  writes or commit during this follow-up.
- Logged Rivals phone compactness (2026-11-03): below 576px, recorded-total cards now use a grid
  with poster at left and total at the title's top-right. Author/genres span the remaining width
  below, replacing the full-width total footer and its 44px minimum. Preserve the shared 112px
  row minimum, all metadata and recorded-count visibility rules; live average-button and desktop
  layouts are unchanged. Source review and formatting only; browser/automated checks deferred.
- Selection empty-rail hit-area correction (2026-11-03): the score container now passes pointer
  hits through to the native Movie link; only its actual buttons restore pointer hits. This
  removes the invisible dead zone before/between score options, while keeping buttons separate
  from navigation. Numeric values, handlers, keyboard behavior and layout remain existing.
  Source reviewed and formatted only; browser/automated checks remain deferred.
- Selection hit-area correction (2026-11-03): anchor the existing link's transparent overlay to
  the whole card, rather than the film content box. Stack the entire score region above it so
  controls and rail space never navigate; keep native link behavior without click propagation
  handlers. Removed title underlining, retained card feedback and moved keyboard focus outline
  to the whole card. Submit scores is 250px wide, clamped on narrow screens. Source review and
  formatting only; browser/automated checks remain deferred. Shared ColorReveal touch behavior
  remains 350ms reveal, fade starting 1800ms after pointer-down; no effect timing or scope changes.
- Selection Movie hit area (2026-11-03): extend the existing native link with a transparent
  pseudo-element through the information area's padding/gap, up to the adjacent score region.
  Stretch the link to its grid row height. Score controls remain siblings; no row click handler,
  nested buttons or stopPropagation. Existing desktop/mobile geometry stays unchanged. Source
  review/formatting only; browser/automated checks and score writes remain deferred.
- Selection alignment follow-up (2026-11-03): film text now starts at the poster's top edge,
  regardless of whether genres/author are present. Compact title/year use fixed grid columns;
  from 1024px the year returns below the title. Source review and formatting only; browser/tests
  and data writes remain deferred in the owner round.
- Selection layout correction after owner review (2026-11-03): year moves to the right of the
  film title, omitting the dedicated year line; author remains conditional. Reduced the stacked
  card gap from 20px to 12px and rail top padding from 12px to 8px. Compact N/M progress now sits
  at the right of the section heading, above the cards; assistive text retains full scored/readiness
  information. Scoring/finality InfoTip moves beside the title. Submit scores is alone on its own
  centered row below the list; removed the lower summary and reserved readiness slot.
  Source reviewed and formatted; browser/automated checks and data writes remain deferred.
- Selection polish (2026-11-03, owner-approved plan): visible 24px/600 Your scores heading and
  instruction, or Nominated films for non-submitting viewers. Cards use Nomination-style borders,
  12px spacing/radius and 48×72px posters, genre chips and whole-item ColorReveal. Poster and text
  share one Movie link; scores remain separate controls. Phone cards keep film information beside
  the poster and the numeric rail below. Plain scored progress sits by Submit scores, with Ready
  to submit/check when complete and finality retained in InfoTip. Saved ballots preserve the rows
  and rails, show Submitted · Waiting for other participants near the heading, and keep selected
  score numbers fully opaque. Score hover now targets enabled buttons, not submitted spans.
  Compact rail alignment uses safe center/flex-end so overflowing scales fall back to their start.
  Numeric scale, unset-versus-zero semantics, validation/focus, submission action and access rules
  reuse existing code. Source reviewed and formatted; browser/automated checks, real score writes
  and commit remain deferred during the owner's fix round.
- Owner-selected follow-up (2026-11-03): submitted Nomination now uses Your nomination with
  Submitted · Waiting for selection, no redundant by-you credit or dimmed own poster, and no
  form minimum height. The shared Current Nominations list and submission rules remain unchanged.
  ColorReveal now uses a broad feather (0.4 of the origin-to-farthest-corner radius) over 350ms;
  removed the light overlay, wave tokens and ring drawing. Existing entry/exit origins, interrupted
  mask composition, eligible surfaces, global switch and reduced-motion behavior are reused.
  Pointer exit still removes farthest color first and finishes at the exit point. Source reviewed
  and formatted only; no browser/automated checks or nomination writes during this follow-up.
  Restarted pnpm dev after confirming PostgreSQL/Redis/MinIO were running; frontend responds HTTP
  200 and backend /health/ready reports database and object storage up. Startup compilation ran as
  part of dev; quality suites and final commit remain deferred in the owner fix round.
- Nomination picker continuity: selection now keeps the search field's dimensions and padding,
  showing a single-line title without a repeated poster/year. Change and the explicit Nominate
  arrow stay inside the field with reserved action space; the arrow is disabled before selection.
  Both actions reuse Button's subtle/icon variant (44px target, 18px icon, common hover/focus),
  and only their glyphs pulse. Suggestion strips reserve press-animation space and hide vertical
  overflow. Manual DOM checks before the hover follow-up found equal field/panel geometry before
  and after selection at 1402px and 320px, including a long title; Change restores search focus.
  A sampled suggestion press produced no vertical overflow in its horizontal scroller. No actual
  nomination was submitted. The final shared-button hover change was checked in source only;
  formatting ran, while browser recheck and automated checks remain deferred in this owner round.
- Simplified scrollbar behavior after owner review: removed ScrollbarActivity, its provider mount
  and activity attributes/timers. Global thin/neutral native styling now applies from initial CSS,
  while visibility/autohide follows browser/OS preferences. Forced-colors remains system-native.
  This removes the hydration-time switch that first showed an ordinary bar and then hid it.
  Removed seven redundant component-level thin-width declarations so native styling is owned
  only by globals.scss. Manual cold/reload DOM checks show the same root/table color and width
  immediately after DOMContentLoaded, after hydration and after scrolling, with no activity attrs.
  Current feature-only cost versus before the scrollbar work: +9 global CSS lines, -8 old local
  width/hiding declarations across nine files, zero controller JavaScript or dependencies.
  Windows/Safari/Firefox were not run live; no screenshots, suites or commit.
- Added activity-only native scrollbars across document and internal/portal scrollers. A single
  provider-mounted ScrollbarActivity capture listener marks the actual scroller, then clears its
  thumb after 800ms idle. Global modern CSS changes thumb color with constant thin width; forced
  colors uses native system styling. Removed the old film-menu always-hidden rule. Owner excluded
  legacy Chrome/Safari support, so there are no WebKit fallback branches or dependencies.
  Native Chrome wheel/DOM checks cover the page, horizontal Club Ratings table and vertical search
  results: active thumb color appears and returns transparent after idle, offsets remain and
  client widths/heights stay equal. Windows/Safari/Firefox and forced-colors were not run live.
  Feature code cost (excluding docs/prior changes): controller +39, global CSS +22, provider +2,
  removed menu override -1 = +63/-1 across four files. No screenshots, suites or commit.
- Corrected suggestions hierarchy after owner clarification: Try again/Watchlist are nested inside
  Find & Nominate, with 16px h3 headings beneath the 24px main heading. The strips remain side by
  side at sufficient width and stack below 768px while still inside that frame. Find uses natural
  content height with a 280px minimum; size containment lets Current Nominations match it on
  desktop without letting its list expand the row. Compact main panels retain natural heights.
  Native DOM at 1402/768/390px confirms both subsections are descendants and geometrically inside
  the left frame, correct heading sizes, desktop paired height equality, phone stacking and no
  horizontal page overflow. Removed the trailing period from visible/assistive film-result counts.
  No data writes/screenshots or automated suites; targeted formatting only.
- Nomination/search follow-up: Current Nomination/own-pick rows are whole Movie links and use the
  shared grayscale/ColorReveal treatment; suggestion buttons share the same feedback. Try again
  and the caller's private Watchlist appear as independent horizontal strips, side by side and
  stacked below 768px, with short titles/InfoTips. Watchlist is ordered High/Medium/Low, then saved
  date and Movie ID, and is exposed only to the eligible viewer; Session visibility rules remain.
  Find & Nominate/Current Nominations use 24px/600 headings, 20px padding and matched 280px desktop
  panels with local nomination scrolling; compact layouts have natural heights.
  Shared MovieSearchResults now renders header and all form pickers: 2px gap, 320px fixed panel,
  32px right-aligned count slot, 64px rows, year and available English genres, five-row skeleton
  including count placeholder, and centered equal-height empty/error states. Search genre data
  is additive/optional for older summaries; provider genre IDs/names normalize without per-film
  requests, and cached metadata supplies known missing genres. Only search projection keys change.
  Manual DOM/native interactions at 1402/390px confirm panel/row/gap geometry, equal main-panel
  heights/headings/padding, mobile stacking/no page overflow, genre metadata, gray-to-color hover,
  and Movie navigation from an item's empty edge. Loading, populated and no-results panels all
  remain 320px; empty text is centered and both searches report the same 17 Interstellar results.
  Existing data has one current nominee and two Watchlist items; large-list scrolling and mixed
  priorities are source-reviewed. No nominations or saved-item mutations were submitted.
  pnpm dev restarted frontend3000/backend3001 with its required shared-package/API compilation;
  no separate suites, full build, screenshots or commit. New DTO fixture coverage remains deferred.
- Documentation hygiene: removed seven raw simplification-area reports (1461 lines) and five
  temporary Phase13–17 files (1190 lines) after verifying durable behavior in Architecture/Design
  and preserving outstanding hosted/owner, live-email and World Tour country evidence gates in
  Roadmap. Current Phase18 and the consolidated audit decisions remain. References were cleaned;
  the Progress table now correctly shows Phase18 In progress without accepting prior phases.
  Independent branch/working-tree hygiene review found no tracked generated/vendor/output/temp
  artifacts, exact text duplicates or lockfile/production/prototype asset churn. Existing reviewed
  UI baselines were retained. Committed local-base→HEAD delta is +14003/−8926; most source churn
  is replacement/refactoring. No commit/history rewrite, suite or baseline update was performed.
- Implemented all eight owner-selected micro-UX refinements: full invitation-link selection on
  focus; explicit allowlisted Club form return view; 44px review hit area with unchanged visible
  geometry; Nomination selection/Change focus continuity; Log Past step-heading focus; shared
  horizontal-overflow edge fades for app tables and Pricing; stale Session feedback clearing on
  edits; shared loading feedback for notification retry.
  Manual browser evidence: Sessions → Log Past → Back returns Sessions; an external returnTo
  remains same-origin via fallback. Review opens from 8px above its visible 24px line. Nomination
  selection focuses Change and Change focuses search, without submitting. Log Past Next/Back
  focuses the appropriate legends after commit, without logging a Session. At 390px table edges
  switch right-only to left-only as local scroll reaches the end; window scrollX remains 0.
  Pricing behaves likewise, and a fitting 1402px table has no edge fades or page overflow.
  Invitation selection, stale-feedback reset and notification failure/retry are source-reviewed;
  no real invitation, Session, nomination or notification read mutation was created. No screenshots,
  test/lint/typecheck/build suites or commit; targeted formatting only.
- Owner enlarged product-header actions: centralized tokens now give Search, Notifications,
  Account and Search Close 48px targets, 42px rings and 20px glyphs; Account uses the shared 40px
  Avatar size. Native local click/DOM checks at 320/390/1402px confirm the control sizes; mobile
  Search/Close rectangles still match exactly, and header heights remain 63/73px without page
  overflow. Account photo sizing is source-reviewed; the measured account fallback glyph is 20px.
  No app data writes/screenshots or automated suites; targeted formatting only.
- Completed six read-only micro-UX audits: chrome/navigation; movies/Sessions; Club/Library
  lists; forms/invitations; public pages; feedback/notifications. Findings remain Proposed.
  Shortlist: preserve originating Club view on Back, smoother picker/wizard focus, larger review
  hit areas, invitation-link selection, coherent retry feedback, subtle horizontal-overflow cues,
  and clearing obsolete form feedback. Manual confirmation: review targets are 24px high at
  desktop and 390px; direct Club Sessions → Log Past → Back returns Overview instead of Sessions.
  Other candidates are source-reviewed, with no form submissions or additional implementation.
- Aligned compact Search and Close using one shared header content-width variable and common
  44px button/34px ring styling. The field fills remaining space below 1024px. Native local
  click/DOM checks at 320/390/768px confirm identical button rectangles/centers (zero delta),
  input autofocus, Escape focus return and no horizontal page overflow. No queries submitted,
  app data writes, screenshots or automated suites; targeted formatting only.
- Unified the mobile wordmark with home: removed the product header's remaining 16px override,
  so public, Club and Session headers inherit the same shared 19px brand typography. Local DOM
  comparison of home and a Club Session at 320/390px confirms matching font family, weight 600,
  size/line-height 19px, left gutter 16px and header height 63px, with no overlap/page overflow.
  No screenshots, app data writes or automated suites; targeted formatting only.
- Owner selected the compact mobile header brand at the left: below 1024px panda and wordmark
  now share one row, with search/actions in normal flow at the right. Removed the obsolete phone
  centering rules and retained 16px phone gutters, 44px action targets and 63px header height.
  Desktop keeps its existing composition. Local DOM checks at 320/390/768/1024px confirm the
  brand is left-aligned and in one row, icon/text vertical centers match, Search stays 44×44px,
  and there is no overlap or horizontal page overflow. At 320/390px both outer gutters are 16px;
  compact header height is 63px and the desktop boundary remains 73px. No screenshots, app data
  writes or automated suites; source formatting only, final commit remains deferred.
- Added a direct hover state to live Nomination Rivals average-score buttons: gold border and
  chevron over the shared 150ms transition, matching focus/open accents. Background stays stable
  so this feedback does not compete with the card's wave. Source review/formatting only;
  browser and automated checks were not run for this follow-up.
- Owner follow-up: unified the reveal and its dismissal fade at 280ms for all remaining surfaces,
  including Movie/Session Details posters and trailer previews. Removed the media/fade timing
  overrides and unused tokens, leaving one duration token. Source review/formatting only;
  browser and automated checks were not rerun.
- Owner follow-up: reduced the media wave from 650ms to 450ms through its shared token;
  the general default remains 300ms. Updated design references and #65. Source review only;
  browser and automated checks were not rerun.
- Owner follow-up: reduced the shared default wave from 430ms to 300ms. Movie/Session Details
  posters and trailer previews retain 650ms. Updated the shared token and design references;
  source review only, without rerunning browser checks or automated suites.
- Owner narrowed the reveal again: Club Ratings, My Ratings and Watchlist return to ordinary
  table hover; removed the now-unused Table wave option. History's row corner radius is removed,
  keeping its 1px separator straight. Default reveal timing is 430ms (about 1.5x faster); Movie/Session
  Details posters, phone tickets and trailer previews retain 650ms. A single enabled flag in
  ColorReveal's config switches remaining surfaces to ordinary 150ms hover with no mask/wave.
  The per-user Appearance control is added to existing #65 (Backlog). Related Movie titles/years
  are centered with 12px horizontal padding and 12px bottom padding beneath the year.
  Manual DOM/native hover: all three tables have zero reveal layers; History has a 0px radius/1px
  separator; general/media durations are .43s/.65s. Temporarily disabling the one config flag
  yields mask:none, the ordinary opacity transition and zero wave opacity; restored enabled=true
  and confirmed the radial reveal. At 390px Related Movie title/year are centered with the specified
  padding and no page overflow. No app data writes, screenshots, automated suites or commit.
- Owner expanded ColorReveal from isolated visuals to whole Session Rating/Rival items, Hub
  Sessions/History and Ratings rows, the entire Call Sheet, Library film rows and Related Movie
  cards. One surface mask projects into images, background, frame/rules and score accents. Live
  links, buttons and reviews are not cloned. Removed independent fast row hover fills and the
  average-score button's hover fill. Members opts out: its avatar uses the previous ordinary
  150ms grayscale filter transition. Native local hover/DOM checks at 1402px show transparent
  row backgrounds, equal mask radii across the Ratings row/avatar/number, full-row layer bounds
  for History/Club Ratings and nine coordinated Call Sheet layers. Members changes grayscale(1)
  to grayscale(0), with zero wave layers. At an actual 390px viewport the Club Ratings overlay
  matches its 640px local table row and the page has no horizontal overflow. Session mobile,
  Library, Related Movies, keyboard/touch and reduced-motion behavior remain source-reviewed.
  No app writes/screenshots or automated suites; formatting only, final commit still deferred.
- Owner selected the thin light wave at 2% after interactive comparisons. Shared `ColorReveal`
  now reveals posters, avatars and the Open Ratings strip from pointer entry or touch, over 650ms.
  Pointer exit contracts color toward the exit point: farthest pixels lose color first, nearest
  pixels last, superseding the earlier outward grayscale wave. The same reveal now covers trailer
  previews and Call Sheet mascots (including the empty sheet); dim exposure, Play/captions and
  document content retain their treatments. Interrupted entry/exit masks are preserved until the next
  transition completes; keyboard uses the center, touch preserves
  clicks/scroll and reduced motion removes movement. Existing muted poster/Call Sheet exposure
  remains. The visual-only color copy is hidden from assistive technology and reuses the same
  source. Wave tokens are centralized in `tokens.scss`. Source review and formatting only;
  automated checks, app browser verification, screenshots and commit remain deferred.
- Sessions row hover/focus now restores poster color and changes the History score from foreground
  to gold-light. Club Ratings scores use the same foreground-at-rest/gold-on-interaction behavior.
  Poster filters, scores and shared table row/header color feedback reuse motion-local (150ms) and
  ease-standard, including the existing reduced-motion override. Tests, screenshots and commit remain deferred.
- Open Ratings film strips now rest in grayscale and restore color on parent-row hover/focus with
  the poster's shared local transition. Members' Invite reuses the subtle Button variant from
  Log Past, with the existing user-plus icon replacing the text plus. Tests/screenshots/commit deferred.
- Owner selected Members “Like History”: replace bordered cards with ruled rows, photo/name/role
  at the left and Session count/removal at the right. Invite keeps the subtle variant. The new
  shared Avatar supplies Members (40px), AvatarGroup (24px) and the header (32px), with Google photo
  or initials, grayscale/restored parent hover/focus and the common local transition.
  Member projections add a nullable same-origin image path; the new private member-avatar endpoint
  checks viewer access and a same-Club active target before reusing the bounded Google downloader.
  No data migration, dependency, provider URL exposure or new CSP origin. Tests/fixtures/checks,
  visual verification, screenshots and commit remain deferred until the owner finishes the round.
- Owner selected centered Invite above the Members list on mobile: below 768px the existing
  compact subtle button is centered; wider layouts keep right alignment. No size, dialog or
  permission behavior changes. Tests/screenshots/commit remain deferred.
- Superseding the placement above: Invite now sits centered below the Members list on all widths,
  using the existing secondary outline variant and a 200px width capped by available space. The
  user-plus icon, invitation dialog and permission gate are retained. Tests/screenshots/commit deferred.
- Shared Achievements (Club Hub and My Library): restored the prototype's 300ms pip-pop press
  animation in place of the shrink, smoothed checkbox transitions and aligned off-state opacity.
  Shelves now cap at three columns from 768px and keep two on mobile; removed the five-column XL
  override. Global reduced-motion behavior remains. Alternative card styling is still a proposal;
  tests/checks, application screenshots and commit remain deferred.
- Owner selected independent boxes as the current Achievements presentation in both scopes:
  shared shelf borders removed, individual rounded outlines and spacing added. Three/two-column
  composition and existing award/filter behavior are retained. Further visual alternatives remain
  proposals; tests/checks, application screenshots and commit remain deferred.
- Superseding independent boxes: owner selected Medals. The shared Club/personal shelf now uses
  unframed groups, shaded double-rim badges (80px/64px), plain status labels and wrapping titles.
  Earned medals/progress use gold-light; other states stay neutral. Criteria, evidence, private
  progress, top filters and three/two-column composition are retained. Source review/formatting
  only; tests/checks, application screenshots and commit remain deferred.
- Owner selected “Thin border” for Medals: each shared Club/personal achievement group now has a
  1px neutral rounded outline with no added background fill. Medals, spacing, three/two columns
  and award/filter behavior are retained. Tests/checks, application screenshots and commit deferred.
- Manage Club aligns Active Ratings with the prototype, including outlined Finish Session using
  the existing typed CLOSE workflow, phase version and server permission. Parallel control reads
  project only permission/counts; failed or changed rows offer Refresh without hiding settings.
  Members moves capacity into the title; the separate places-in-use sentence is removed. Admins
  now always see Delete Club, disabled with a visible history explanation when deletion is forbidden.
  No deletion, archive, close transition or other application mutation was performed.
- Owner confirmed the proposed next visibility model: nomination authors, named Selection scores
  and Session ratings each get During/After switches; Black & White stays separate and Selection
  visibility loses its Pro gate. During other-score disclosure starts only after the viewer's own
  response; After begins only at Completed. All roles, including Admin/Moderator, obey the switches.
  Four Settings layouts are proposals only. New fields, named Selection projections, policy
  migration and tier removal are not implemented yet. Existing Session privacy must be preserved.
  Useful optional controls considered: retain independent pre-submission nomination-list visibility,
  and a default Nomination deadline for new Sessions. Neither extra is implemented by this proposal.
  Source review/formatting only; tests/fixtures/checks, screenshots and commit remain deferred.
- Owner selected two Settings tabs. Implemented During/After controls, separate monochrome field,
  no introductory/applies-to-new copy, and the everyone rule solely in the Settings tooltip. Both
  tab panels remain mounted for form serialization. Removed the standalone disabled-delete hint;
  the existing action tooltip retains the reason. Additional Appearance ideas remain proposals.
- Six period flags now persist on Clubs and new Session snapshots. New disclosure requires own
  submitted Selection/Rating during the Session, starts After only at Completed, and has no role
  or plan bypass. Author-only rivals remain independently visible without exposing score totals.
  Authorized named matrices use frozen closure scores or sparse imported cells. Old Session rows
  keep all-null new flags and their previous disclosure boundaries; legacy individual ballots stay
  hidden. API, Hub averages, analytics, private result-derived achievements and award notification
  resolution share these gates. New-policy cancelled Sessions disclose no peer scores.
- Conservative private-achievement boundary: when any new Completed Session hides a result
  category, its related private achievement keys are hidden across that Club, including older
  earned cards of those keys. Award history remains stored; other keys stay visible.
- Applied migration 20261103000200_club_visibility_periods to positively identified local
  pickflick_local on 127.0.0.1:25432 and regenerated Prisma Client. No existing Session backfill,
  reset, synthetic Session action or email event was performed. Added only two legacy-null defaults
  to the runtime-compiled achievement fixture helper so dev can compile; assertions/test scenarios
  and remaining fixture updates stay deferred. Dev API starts successfully; full test/type/lint and
  application screenshot checks, plus the final single commit, remain deferred for the round end.
- Fixed adjacent Hub failure buttons with a shared wrapping action row and standard gap. Shared
  failure cards use compact phone padding so action labels fit narrow screens. Shared
  Tabs now suppress vertical overflow and position the active underline inside the list bounds.
  Manual Manage Club inspection at 1402px and 390px shows equal tab-list scroll/client heights
  (44px), with no horizontal page overflow. No settings writes or application screenshots performed.
- Diagnosed actual Settings read failures despite healthy readiness: the source Prisma client had
  been regenerated, but the running database package still used its old built client. Rebuilt
  @pickflick/database, triggering the existing dev watcher; authenticated GET Club settings now
  returns 200 and the page renders. Local-development guidance now requires the runtime rebuild
  after schema updates. This was development setup, not a test/verification suite; commit deferred.
- Owner moved all Appearance controls out of Club management and into planned personal Settings.
  Removed the monochrome control and its editable Club API field; retained existing Club/Session
  media columns without rewriting values or history. The current Settings card now contains only
  During/After Session visibility. Personal monochrome, quiet mode, Comfortable/Compact spacing and
  a reusable optional-table-column setup are scoped in [#201](https://github.com/Shagon1k/PickFlick/issues/201)
  for activation with Phase 19 personal Settings, rather than implementation in this verification round.
  No appearance preference runtime/storage was added. Tests/checks/screenshots and commit remain deferred.
- Appearance #201 is now a native child of the personal Settings/profile task #65, planned with
  that Phase 19 work. Parent and child descriptions cross-link the scope; implementation remains
  outside the current verification round.
- Consolidated Appearance scope and acceptance into existing personal Settings #65. The temporary
  #201 was closed as a duplicate, detached as a sub-issue and removed from the Project to avoid
  parallel tracking. Personal Appearance implementation remains planned with Phase 19.
- Manage Club moves Selection score range from Club Info to Settings, with exactly one scale
  pair in each submitted form (edited in Settings, preserved in Club Info). Removed the repeated
  Members score nominations caption from the shared slider while keeping accessible value/error
  associations. Removed the Avatar caption and moved format/size/private-upload guidance to the
  Club Info heading tooltip; the metadata row renders only for preview/removal controls.
  Tests/checks/screenshots and commit remain deferred.
- Manual Manage Club DOM inspection confirms no slider in Club Info, one slider in Settings,
  exactly one min/max input pair in each form, no repeated range caption and no Avatar title row.
  The preview identity is read-only, so range/file inputs retain permission restrictions. No save,
  upload, removal or other application mutation was performed.
- Selection score range is the final Settings field, below the visibility tabs and before Save
  Changes, per the owner's placement correction. Tests/checks/screenshots and commit deferred.
- Replaced repeated Trailer pills with shared clean arrows and a position counter for up to three
  distinct videos. Each selection now uses its own cached YouTube thumbnail, with the shared local
  fade timing and a neutral cover when unavailable. The chooser and Search YouTube footer disappear
  during playback; the iframe still loads only on Play. A new authenticated thumbnail endpoint
  accepts only a Movie's cached trailer IDs and reuses bounded image storage on a fixed ytimg URL.
  Manual local inspection of Obsession confirmed two loaded 480px previews, changed image paths
  and the counter advancing from 1 / 2 to 2 / 2, with no iframe loaded. No Play action, application
  screenshots, test/verification suites or commit. Owning issue #63 remains In progress.
- Fixed the phone film ticket's empty action rail: the shared rail-empty condition now also removes
  both outline/poster notch masks and the perforation, restores the poster's lower corners and
  removes the stub grid row. Headers with actions retain their existing ticket treatment.
  Source inspection/formatting only; browser screenshots, tests/checks and commit remain deferred.
  Shared action-motion alternatives are proposals only; no global motion behavior was changed.
- Trailer follow-up: handle already-complete cached images when the img ref attaches, so a load
  event before hydration cannot leave a successful preview transparent. Keep the normal lazy/load
  and unavailable-image paths. Position Play at 50% of each card axis with an independent translate;
  the top name and bottom controls no longer alter its centre. Source review/formatting only;
  the reported mobile intermittent case has not been reproduced in this follow-up. Tests/checks,
  application screenshots and commit remain deferred. Cinematic action-motion options are proposals.
- Owner selected the 350ms pulse without a wave or hover growth. Implemented shared delegated
  pointer-down and activation-key feedback in the UI provider, preserving existing actions/focus,
  color transitions and independent transform geometry. Peaks are 5% default, 8% shared buttons,
  10% Achievements filters and 12% compact controls. Hidden inputs animate their visible marks;
  trailer Play animates only its ring. Replaced conflicting Button/ClubSwitcher press transforms,
  Achievements pop, selected-scale pop and Play hover zoom. Disabled/read-only/busy/inert states
  suppress feedback; held-key repeats are ignored and reduced-motion changes cancel active pulses.
  Source review/formatting only; automated tests, browser verification, application screenshots and
  the final single commit remain deferred for the round end. Owning issue #63 remains In progress.
- Owner reported that the new pulse was invisible. In the live local app, CSS optimization exposes
  the 350ms token as .35s; parsing only its number produced a measured 0.35ms animation. Fixed the
  unit conversion. After reloading, native clicks on the Achievements filter and Movie Details
  Personal Rating trigger produce measured 350ms animations with 1→1.10→1 and 1→1.08→1 keyframes,
  visible intermediate growth and return to rest. Only a local filter and rating popover were
  toggled; no rating was submitted or other application data changed. No screenshots or automated
  suites. Other states/devices and the single commit remain deferred for round-end verification.
- Fixed Saved/Copied contrast in the shared Button: variant hover selectors had higher specificity
  than the success state and restored an ivory primary fill behind pale success text. Success now
  explicitly retains its own text/background/border on hover and focus-visible for every variant.
  Source cascade review/formatting only; no settings save, browser screenshot, automated checks or
  commit performed for this case.
- Owner follow-ups: removed the separate success palette, which caused a color flash before
  Saved; the existing label/check confirmation animation now inherits the ordinary variant palette.
  Added enabled-only hover backgrounds/borders to Manage Club checkboxes, shared Switch and Past
  Session attendee chips. Tabs now pulse only an inner label; Hub section navigation also explicitly
  hides vertical overflow. During native local clicks, the Settings tab list stayed 470×44 with
  matching scroll/client dimensions through the pulse; Hub navigation stayed 1072×47 with no
  transient overflow on either axis. The preview identity is read-only, so enabled Settings hover
  remains source-reviewed rather than exercised. No saves, screenshots or automated suites.
- Centralized the remaining press peak offset in `tokens.scss`. Duration, easing, peak timing and
  all four amplitudes can now be tuned in that one file; components choose a role/surface while
  the shared runtime retains the keyframe sequence. Final cross-device checks and commit deferred.
- Owner selected the compact Session status capsule, reduced slightly from the proposal.
  Added shared SessionStatus at 28px height with 11px body text and uniform 14×14px SVG icon boxes;
  added Play to the existing Icon library. Session headers keep one capsule DOM node beside the
  title on desktop and position it at the poster's top-right on phones. Logged preserves its
  original tooltip. Removed the old uppercase stamp, live dot and inherited poster-pill skin.
  Manual local DOM checks at 1402px (Logged) and 390px (Logged, Rating, Completed) show matching
  icon/label vertical centers, 28px capsule height and no horizontal page overflow. No app data
  writes or screenshots. Automated suites and the final single commit remain deferred.
- Owner selected the desktop placement at the right edge, on the title's center line. Headers with
  a status now use a two-row grid from 768px: title/status across the top, metadata/actions below.
  The title can wrap within its remaining width while the capsule keeps its right alignment.
  Phone poster placement, capsule size/icons and phase/permission logic remain unchanged.
  Source review/formatting only for this placement change; browser screenshots, automated checks
  and the final commit remain deferred.
- Corrected the Session information-column proportions to the prototype's three-column spans:
  credits cover the poster column plus the first half of the trailer, while Synopsis occupies the
  remaining column. This preserves the already accepted responsive 3:8 poster/trailer sizes.
  Movie Details retains its own prototype's 50/50 split; phone/tablet information layout is unchanged.
  Added an explicit MovieMedia variant for these two current design cases. Source review/formatting
  only. Three coordinated Ratings/Nomination Rivals layouts are proposals, not implemented: ruled
  History rows, thin outer panels or independent row cards. Proposed headings share the Open Ratings
  body typography; matched row geometry and a common 300px list cap cover equal/unequal/long lists.
  Tests, screenshots and commit remain deferred.
- Owner chose independent row cards with the existing outer panel borders retained. Implemented
  shared 112px row minimum/300px list maximum, stretched desktop panels, equal padding/header
  slots and the exact Open Ratings heading token (24px, 600 body sans). Rivals retain real posters;
  Ratings now use shared Avatar with protected photo URLs and initials, including own-only views.
  The contract adds author/avatarUrl to own and avatarUrl to result entries; participant photos
  remain ACCEPTED-only and result visibility is unchanged. No new avatar endpoint or permission.
- Live average Selection scores now have a framed avg. button, chevron and hover/focus/open cues.
  The existing aggregate popover remains; imported totals are plain, non-interactive values.
  Local native/DOM inspection on a two-row live Completed Session confirmed equal 342px panels,
  112px rows, matching 24px headings, two loaded user photos and two loaded posters. The 3.5 avg.
  button opens details and Escape closes them. At 390px panels stack with no page overflow.
  No app data writes or screenshots. Automated suites and required rating DTO fixture updates
  remain deferred until the owner finishes the case-by-case round, followed by its single commit.
- Added 8px to the rating number's right inset. Review triggers now show a small open/close chevron.
  Split Selection details from the Watchlist popover variant; below 576px it and Review use opaque
  full-available-width panels with 20px side gaps, retaining desktop anchoring and focus return.
  Gray row backgrounds now require actual fine-pointer hover, rather than focus-within, avoiding
  a stuck selected appearance after popovers close or on touch.
- Local native/DOM checks at 390px confirmed both detail popovers at x=20, width=350, right gap=20,
  with opaque backgrounds and no page overflow. Escape returned focus to each trigger while the
  peer card background remained transparent after moving the pointer away. No app data writes,
  screenshots, automated checks or commit.
- Minor, unconfirmed cursor report: owner sees the arrow on every hovered control in Chrome,
  with device emulation off and working clicks/hover colors. Source review and local hit testing
  show cursor:pointer on Search, navigation controls and their actual hit descendants, with no
  blocking overlay; the same remains true after popover dismissal. The press runtime does not
  set cursors. Native cursor shape in the owner's window was not verified; owner will recheck.
  No speculative global cursor override was introduced.
- Owner removed the redundant Final/lock badge and the strong own-rating highlight. The own row
  stays first and reads You, but now shares peer cards' neutral border/background and hover rules.
  Session Rating immutability and visibility are unchanged. This supersedes the earlier #22/Final
  presentation. Source review/formatting only; no app writes, screenshots, automated checks or
  commit for this case.
- Right-aligned imported Selection totals and removed their oversized centered metric layout.
  Equal per-film score counts are now assistive-only rather than repeated visibly; differing
  counts stay visible to preserve the meaning of partial logged evidence. Totals themselves remain
  labelled total, not averages. Added shared Avatar extra-large (48px) and applied it only to
  Ratings; existing 24/32/40px consumers retain their sizes.
  Local DOM inspection of the reported logged Session confirmed 8/7 at matching 21px right insets,
  compact total captions, hidden equal counts, three 48×48px avatars and no page overflow.
  No app writes/screenshots, automated tests or commit; unequal-count behavior was source-reviewed.
- Unified Rating/Completed result placement through SessionResults (renamed from Completed): the
  Ratings/Rivals pair and permitted Selection matrix follow Session Details in both phases.
  Available/own responses retain server visibility; an empty active panel uses dash/In progress.
  YourRating is now a separate prototype-based card (720px maximum, outline/gold top line, mono
  heading, neutral stars, compact transparent comment and centered submit/InfoTip). During Rating
  it switches from inputs to the saved score. Submit, validation, finality and polling are reused.
- Completed headers now use readonly Club / historical Session You / Global cells. Extracted the
  existing GlobalMovieRating display so Movie Details and Sessions share source selection, counts
  and accessible scales. SessionStatus now overlays both desktop and phone posters, preserving
  Logged's InfoTip and an unavailable-media inline fallback. No Personal Rating is read by the
  historical You cell. Increased shared rail icons to 20px and centered value/label groups; Movie
  Details Personal Rating now shares the same 20px desktop/16px phone numeral sizing/alignment.
- Manual local DOM checks: the Rating Saved card is 720px and its results appear after Session
  Details. Completed's three cells are readonly and align with the title; all icon/value/label
  centers match on desktop. Movie Details Global and existing Personal Rating also share centers.
  At 390px both ticket rails retain their stacked phone layout with no page overflow; only the
  appropriate poster capsule is visible. No ratings were submitted, app data changed or screenshots
  captured. The available Rating Session already has an own response, so the new-entry form and
  empty In progress branch remain source-reviewed, pending round-end behavioral/visual checks.
  Automated tests, fixture/baseline updates and the single final commit remain deferred.
- Aligned Watchlist priority popovers with the rating picker: opaque surface, common frame and
  compact 336px maximum width/8px outer padding. Removed the nested priority-group capsule;
  three equal choices and a separate removal control retain 44px heights and existing save rules.
  Fixed the star focus ring in two steps: a 28px square replaced the stretched target outline,
  then native button padding/SVG intrinsic overflow was removed so icon and frame share 50% centers.
  The user's follow-up caught the earlier icon/frame offset; final local DOM checks show matching
  left/top/translation and effectively zero icon-center offset in both axes.
- Manual checks confirmed both desktop pickers at 336×70 with 8px padding, unchanged 24px stars,
  and 44px priority/removal controls. A narrow 320px check showed a single priority row without
  clipping or page overflow. Opened only an already saved bookmark and used Tab/Escape; no priority
  or rating changes, screenshots or automated suites. A stale duplicate dev CSS chunk temporarily
  retained 12px padding; a full page navigation cleared it and confirmed the final 8px styles.
  Tests/baselines and the single final commit remain deferred.
