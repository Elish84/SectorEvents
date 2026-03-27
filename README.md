# Antigravity Multi-Agent App Team

This package defines a strict multi-agent operating model for building and maintaining an application in Google Antigravity.

## Core Rule
**The user talks only to the Project Manager.**
No specialist agent may speak directly to the user.

## Command Flow
User → Project Manager → Specialist Agents → Project Manager → User

## Included Agents
- project_manager
- architect
- frontend
- backend
- database
- networking
- security
- qa
- data_analyst
- summarizer

## Operating Principles
1. Project Manager is the only external-facing agent.
2. Every task must be created in a standard task format.
3. Every agent must answer in a standard response format.
4. Summarizer updates project memory after every completed cycle.
5. Architect approves cross-cutting design changes.
6. Security must review auth, secrets, permissions, and external interfaces.
7. QA defines acceptance criteria and validation before a task is considered done.

## Recommended Usage Order
1. Load `agents/project_manager.md`
2. Load all specialist agents
3. Load `schemas/task.schema.json`
4. Load `schemas/agent_response.schema.json`
5. Load `schemas/project_memory.schema.json`
6. Start with the prompt templates in `prompts/`

## Suggested Folder Mapping in Antigravity
- System prompt for each agent: `agents/*.md`
- Shared contract files: `schemas/*.json`
- Reusable coordination prompts: `prompts/*.md`
- Process documentation: `workflows/*.md`

## Lifecycle
### New user request
- PM reads the request
- PM creates one or more tasks
- PM routes each task to the correct agent(s)
- PM collects responses
- PM resolves conflicts / asks Architect or Security or QA when needed
- PM answers user
- Summarizer updates memory

### Change request
- PM checks impact
- Architect validates system implications
- Backend / Frontend / Database implement
- QA validates
- Summarizer records final decision

### Incident / bug
- PM opens incident task
- QA reproduces
- Relevant engineering agents diagnose
- Security joins if exposure/risk exists
- PM decides rollback / patch / next action
- Summarizer records root cause and fix

## Notes
- This package is optimized for app development.
- It is intentionally strict to avoid agent overlap and memory drift.
