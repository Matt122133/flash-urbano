---
name: harness-loop
description: "Run the spec-kit loop termination check."
disable-model-invocation: true
---

Run:

```bash
python3 scripts/harness/speckit_gate.py loop
```

Report the command output verbatim. A non-zero exit halts the calling spec-kit
command; do not proceed past a failed loop check.
