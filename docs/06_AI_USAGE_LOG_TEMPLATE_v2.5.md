# **AI Usage Log Template**

**Global Employee Compensation Management System**

*Incubyte Assessment • Version 2.5*

## Purpose

Record AI assistance transparently for the assessment. The log should reflect actual usage, not planned or assumed usage. Review, test, and understand all generated suggestions before accepting them.

## Entry Template

| Field | Record |
| --- | --- |
| Date / commit |  |
| Tool/model and version (if known) |  |
| Task / file / code area |  |
| Prompt or concise prompt summary |  |
| Output used (what was accepted) |  |
| Output rejected or modified |  |
| Human review performed |  |
| Tests / validation run and result |  |
| Security/privacy review |  |
| Known limitations or follow-up |  |

## Review Checklist

- Do not include secrets, credentials, customer data, or real employee compensation information in prompts.
- Verify tenant isolation, domain authorization, RLS behavior, and access-control paths independently.
- Check generated SQL, migrations, dependencies, and AWS IAM/KMS policies before use.
- Run tests and inspect code; AI-generated code is not treated as verified merely because it compiles.
- Record meaningful changes and the reasoning behind acceptance/rejection.
