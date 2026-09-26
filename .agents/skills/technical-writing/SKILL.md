---
name: technical-writing
description: Write, restructure, or review clear technical documentation by choosing its purpose with Diátaxis, addressing the reader directly, controlling sentence load, and removing ambiguity. Use for READMEs, tutorials, how-to guides, reference docs, explanations, RFCs, ADRs, runbooks, API docs, PR descriptions, commit-message prose, and code comments. Preserve technical accuracy and repository conventions. Not for product UI, marketing, legal text, or Conventional Commit structure.
user-invocable: true
disable-model-invocation: false
---

# Technical Writing

Write for a tired engineer who needs to understand the document on the first read. Preserve facts,
requirements, uncertainty, identifiers, commands, and the author's defensible judgment.

## Core principles

- **Cut dead weight.** Remove every word that adds no meaning. "In order to" becomes "to." "It
  is important to note that" disappears.
- **Prefer plain words.** Use the shortest familiar word that stays precise. Write "use," not
  "utilize"; "help," not "facilitate." Keep a longer technical term when it is the exact one.
- **Serve the reader.** If a rule makes the sentence worse, rewrite another way or leave it alone.
  Correct but mechanical prose has still failed.
- **Keep certainty.** Preserve the strength and scope of every claim. "May fail" does not become
  "fails," and "reduces the risk" does not become "prevents."
- **Name real things.** Use the actual symbol, path, flag, command, or component name. Do not
  replace it with a vague synonym or an invented metaphor.

## Pick the document mode

Choose one dominant purpose per page. Supporting details are fine; split and link when they begin
serving a different reader need:

- Action + learning: **tutorial**.
- Action + work: **how-to**.
- Understanding + work: **reference**.
- Understanding + learning: **explanation**.

**Tutorial — learn.** Guide a learner through a successful first experience. Say what they will
  build, produce a visible result early, and describe what they should see after each step. Keep
  explanation short enough that it does not interrupt the lesson.

**How-to — achieve.** Help a competent reader reach a concrete goal. Start near the action,
  include real decision points, and omit background that does not change what the reader does.

**Reference — look up.** Describe interfaces, parameters, defaults, limits, outputs, and errors.
  Mirror the system's structure where useful. Keep terminology stable and generate factual
  material from code when possible.

**Explanation — understand.** Explain one bounded topic through context, constraints, design
  choices, alternatives, and trade-offs. Take a position when the evidence supports one.


Use the mode as a compass, not a purity test. A tutorial can name a default; a how-to can explain a
decision. Move material only when its different purpose starts competing with the page's main job.

*Based on the [Diátaxis documentation framework](https://www.diataxis.fr/).*

## Write to the reader

- **Address readers.** Use "you" for reader actions and present tense for current behavior. Use
  third person for software behavior: "The server returns an error."
- **Name actors.** Write "The compiler checks the schema," not "The schema is checked." Keep
  passive voice when the actor is unknown, irrelevant, or deliberately backgrounded.
- **Give commands.** Write "Click **Submit**," not "You should click **Submit**." Distinguish
  requirements, recommendations, options, and possible outcomes instead of hiding them in
  "should."
- **Lead conditions.** Write "To delete the document, click **Delete**." Readers can skip an
  instruction when its condition or goal does not apply.
- **Order cases.** Explain the common path first and exceptions afterward.
- **Sound natural.** Be direct, helpful, and specific. Do not call a procedure "simple," "easy,"
  or "quick"; the reader may be here because it is not.
- **Write links.** Name the destination. Write "See the deployment guide," not "Click here."
- **Shape headings.** Use sentence case. Use a verb phrase for a task—"Create an instance"—and a
  noun phrase for a concept.
- **Choose lists.** Use numbers for sequences and bullets otherwise. Introduce the list and keep
  its items grammatically parallel.
- **Format terms.** Put code, paths, flags, and identifiers in code font. Follow repository rules
  for UI elements, punctuation, and examples.

*Adapted from the [Google developer documentation style guide](https://developers.google.com/style/highlights).*

## Control sentence load

- **One instruction.** Put one required action in each procedural sentence. Keep simultaneous
  actions together only when separating them would change the procedure.
- **One main idea.** Give each sentence one point. Keep a longer sentence when its condition or
  consequence belongs to that point.
- **Lead safeguards.** Put prerequisites, warnings, and conditions before the action they govern.
- **Use commands.** Write "Install the component," not "The component must be installed."
- **Keep terms stable.** Use one term for one concept and one verb for one recurring action. Do not
  alternate between "start," "launch," and "initiate" for decoration.
- **Check length.** Review procedural sentences above roughly 20 words, but split them only when
  doing so improves comprehension.

*Uses transferable principles from [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/STE_faq.html); it does not claim full STE compliance.*

## Remove ambiguity

- **Place modifiers.** Put "only," "not," and similar words next to what they modify. "Request
  only one token" is clearer than "Only request one token."
- **Name referents.** Make every "it," "this," and "they" point to one obvious thing. Repeat the
  noun when needed.
- **Break noun stacks.** Replace "the proto import budget check script" with "the script that
  checks the proto-import budget."
- **Complete clauses.** Give each clause a subject and verb when omission can confuse the reader.
- **Clarify groups.** Rewrite ambiguous combinations of "and" and "or." Use "either...or" or
  "both...and" when they reveal the intended grouping.
- **Keep names stable.** Use one name for one concept across the document. Repetition is cheaper
  than teaching the reader three synonyms.

*Also informed by John R. Kohl's **The Global English Style Guide**.*

## Vary the rhythm

- **Mix lengths.** Use short sentences for emphasis and longer ones for a fact with its condition
  or consequence.
- **Keep one idea.** Split sentences that require backtracking, not every sentence over an
  arbitrary length.
- **Stay specific.** Prefer "a column rename fails the build" to "schema changes can cause
  issues."
- **Use judgment.** Explain trade-offs and conclusions where the document mode permits them.
  Reference material can stay dry.

## Respect the repository

- **Follow local rules.** Repository terminology, templates, style guidance, and formatting take
  precedence over this skill.
- **Verify claims.** Check symbols, paths, commands, defaults, counts, and behavior against the
  current source. Include regeneration commands when generated facts can drift.
- **Preserve scope.** Do not invent behavior, rationale, guarantees, or consensus. Keep uncertainty
  when the evidence is uncertain.
- **Limit the mode.** Apply Diátaxis to documentation pages and sets. Apply the sentence-level
  rules, not the four-mode taxonomy, to PR descriptions, commit-message prose, and code comments.
- **Respect ownership.** Let specialized formats keep their own rules. This skill can improve a
  commit message's prose, but the Conventional Commit workflow owns its structure.

## Worked examples

### Rewrite a procedure

Before:

> Configuration of the proto import ratchet budget script parameters is performed via
> `budget.json`. Note that it is important to remember that running with `--write`, which updates
> the committed budget to reflect the current count, should only be done when lowering it. If
> exceeded, CI fails.

After:

> `budget.mjs` reads the committed budget from `budget.json` and counts the files that import
> protos. If the count exceeds the budget, CI fails. Run `budget.mjs --write` only to lower the
> budget.

The revision names the actor, uses real identifiers, moves the condition before the command, places
"only" next to what it modifies, and removes words that add no meaning.

### Separate reader needs

Before, one "Getting started" page contains installation steps, a complete flag table, and several
paragraphs defending the timeout design.

After:

- **Tutorial.** Install the tool, run the first command, and show the expected output.
- **Reference.** List each timeout flag, default, limit, and error separately.
- **Explanation.** Describe why the tool uses a hard timeout and which alternatives were rejected.

The facts stay connected through links, but each page answers one dominant reader need.

## Review once

1. **Purpose.** Does the page have one dominant Diátaxis mode?
2. **Action.** Are instructions direct, ordered, and guarded by preceding conditions?
3. **Clarity.** Can any sentence, pronoun, modifier, or noun stack be read two ways?
4. **Precision.** Are symbols, paths, commands, limits, and terms exact and consistent?
5. **Economy.** Can anything be removed without losing meaning?
6. **Rhythm.** Does the result read naturally rather than like controlled-language output?

Fix the failures, confirm that no claim changed strength, and stop. Do not rewrite stable text only
to make it different.
