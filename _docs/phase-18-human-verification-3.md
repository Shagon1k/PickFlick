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

## Final verification, 2026-11-01

- `PICKFLICK_ENV_FILE=.env.example pnpm verify`: lint, knip, formatting, type checks, 609 unit
  tests and production builds pass.
- Database integration: 320/320 on isolated `pickflick_test`, with email delivery disabled.
- Real-API journeys: 16/16. The final Past Session rerun passes 6/6, including the explicit
  no-creation-before-submit assertion, retry preservation, partial evidence, axe, keyboard/touch
  and 390/768/1024/1440 widths.
- Five previously failing UI checks pass in the pinned Linux image after selectors and
  hydration/animation waits match the delivered interface.
- `pnpm deploy:check`: local, UAT and production definitions render. No deployment is performed.

The phase remains open for exact-head hosted owner acceptance, live email delivery (#39) and the
two-account Hub refresh observation carried from the earlier review. Accepted design choices and
local screenshot review do not establish those UAT results. Keep this register until the gate closes.
