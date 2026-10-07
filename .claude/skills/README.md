# Meyy skills — the master copies

This folder is the single place where every Meyy skill is kept. It travels with the code:
GitHub on every push, and iCloud on every run of the mirror (the rsync line in STORAGE_POLICY.md).

| Skill | What it does | Also installed in |
|---|---|---|
| chapter | Aruvi chapter pipeline (summary + mapping) | Claude account |
| canonical | canonical plan work | this repo only |
| meyy-support-desk | drafts WhatsApp/email support replies for Kumar to approve | Claude account |
| aruvi-kb-refresh | refreshes the Ask Aruvi Q&A knowledge base | Claude account |
| morning | morning brief | Claude account |
| disaster-recovery | lost/broken Mac playbook and drill, runs from the phone | Claude account; extra copy in security_docs/legal/Meyy/skills |

Rule: when a skill is changed in the Claude account, copy the new SKILL.md here too (ask Claude:
"sync my skills to .claude/skills"), then commit and push. No secrets ever go in a SKILL.md.
Last synced: 2026-10-07.
