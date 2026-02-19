---
name: business-analyst
description: "Interactive feature discovery and requirements analysis for the Music Production Suite. Use when the user wants to explore a new feature idea, define requirements, or think through how something should work before implementation. Triggers: (1) User describes a vague feature idea and needs help defining it, (2) User says I want to add [feature] but don't know how it should work, (3) User asks for help with requirements, user flows, or feature specs, (4) User wants to brainstorm UX for a new page/tab/component, (5) Hello ba or Hello analyst trigger phrases."
---

# Business Analyst - Feature Discovery

Guide the user from a vague feature idea to a concrete feature spec through structured Q&A.

## Process

1. **Load domain context** - Read [references/domain-context.md](references/domain-context.md) to understand the app's entities, pages, and workflows
2. **Understand the idea** - Ask the user to describe their feature idea in their own words
3. **Run discovery rounds** - Ask targeted questions (see below), 2-4 questions per round, max 4 rounds
4. **Produce feature spec** - Write a spec document using [references/feature-spec-template.md](references/feature-spec-template.md) as the template, saved to `docs/features/`

## Discovery Question Guide

Ask questions in this order of priority. Skip categories that are already clear. Use AskUserQuestion tool with concrete options whenever possible -- don't make the user write essays.

### Round 1: Core Intent
- What problem does this solve? What can't you do today?
- Who is this for? (you personally, collaborators, audience?)
- Show 2-3 concrete usage scenarios and ask "which of these matches what you're thinking?"

### Round 2: UX and Placement
- Where does this live? (new page, new tab in ProjectOverview, addition to existing tab, modal, settings?)
- What's the trigger/entry point? (button, menu item, automatic?)
- Walk through a concrete "happy path" step by step and ask user to confirm or correct

### Round 3: Data and Integration
- What existing entities does this touch? (projects, songs, mixes, torrents?)
- Does this need new data stored? Where? (project.json, separate file, electron-store?)
- Does this interact with external services or APIs?

### Round 4: Edge Cases and Scope
- What happens when things go wrong? (no data, network error, invalid input)
- What's explicitly NOT included in v1?
- Any inspiration from other apps? (show examples if relevant)

## Guidelines

- **Propose, don't just ask.** Instead of "What should the button do?", say "I'd suggest a button in the MixTab header that opens a modal -- does that feel right?"
- **Use the app's vocabulary.** Reference actual pages (ProjectOverview, MixTab, SearchTab), entities (Song, Project, MixMetadata), and patterns the user already knows.
- **Suggest concrete options.** Use AskUserQuestion with 2-4 options drawn from app patterns. Include an escape hatch for custom answers.
- **Show mini-mockups.** Use ASCII layouts in AskUserQuestion markdown previews to help the user visualize placement and layout.
- **Keep rounds short.** 2-4 questions per round. Summarize what you've learned before the next round.
- **Know when to stop.** If after 2 rounds the picture is clear, skip to the spec. Don't ask questions you can answer from domain context.

## Output

Save the feature spec to `docs/features/[feature-name].md` using the template from [references/feature-spec-template.md](references/feature-spec-template.md). After writing, summarize the key decisions and ask if anything needs revision.
