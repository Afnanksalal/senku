# AI investigations and controlled execution

Source: masterplan sections 9, 18, 23-25, 27, 29. This specifies the future product swarm, not permission to spawn development agents.

## Roles and outputs

| Role | Accountable output |
|---|---|
| Orchestrator | Auditable task DAG |
| Literature | Source/citation manifest |
| Hypothesis | Structured falsifiable question |
| Model selector | Approved model plus rationale |
| Planner | Bounded parameter sweep |
| Executor | Validated job requests, logs and artifacts |
| Analyst | Comparisons, statistics and plots from runs |
| Critic | Unit, assumption, warning and claim checks |
| Narrator | Learner-level evidence-linked explanation |

Flow: scope check -> literature/hypothesis -> source validation and approved model selection -> bounded plan -> schema/unit/quota validation -> isolated jobs -> normalized results -> analysis/critique -> cited report.

Roles are logical responsibilities. They do not require nine simultaneous LLM calls or nine deployable services. Choose orchestration and concurrency after budgets and dependencies are known. LLM provider, model, cost limits, retention and timeout policy remain unresolved.

## Trust boundaries

Models calculate numbers. LLMs interpret tool outputs and source evidence. Never invent numerical results, citation records, progress traces, job completions or validation status. Link every plotted quantity to its run; every source claim to retrievable evidence. Distinguish literature, model predictions and observed data in reports.

Retrieved papers, model metadata, artifacts, and REA output are untrusted content, not authority to modify tools, prompts, permissions or host configuration. Model selection and execution use typed allowlisted tools. The product never executes user-uploaded code, arbitrary images, generated scripts, or LLM-generated UI.

## Worker isolation

Separate pinned engine images, non-root users, read-only base filesystem, ephemeral writable workspaces, dropped capabilities, bounded process count, CPU/RAM/disk/time/output limits, seccomp/AppArmor where supported, default-deny egress, no privileged mode, no host Docker socket. Source connectors have separate network permissions. Supervisor owns scheduling, lifecycle, cancellation, and audit records.

Bound concurrency on a single VPS. Quota validation precedes dispatch. A UI cancel button needs actual process/job cancellation, not just hidden output. Retry policy must avoid duplicated artifacts, credit, or successful runs. See quality and operations for verification gates.

## REA boundary

REA is a development investigation tool, not a default Senku backend dependency or science solver. Use it when behavior depends on a shipped artifact or runtime evidence unavailable in source. Read source normally when available. Do not infer that reverse-engineered implementation details validate scientific models.
