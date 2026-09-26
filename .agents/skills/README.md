# Agent skills

Project skills shared by every agent. Codex discovers them here; Claude Code reads them through the
symlinks in `.claude/skills/`.

| Skill               | Use                                                     | Source                                                                                                                          |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `technical-writing` | Write or review any documentation, PR text, or comment. | [shag-ai-plugins](https://github.com/Shagon1k/shag-ai-plugins) `plugins/engineering-tools/skills/technical-writing` @ `0c308aa` |

Skills are vendored verbatim so both tools use the same version. To update one, copy the skill
folder from its source over the vendored copy and record the new commit here. To add one, place it
in `.agents/skills/<name>/` and link it with `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.
