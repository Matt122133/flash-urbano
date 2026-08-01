---
name: harness-gate
description: "Run the spec-kit implementation gate."
disable-model-invocation: true
---

Run:

```bash
python3 scripts/harness/speckit_gate.py gate
```

Report the command output verbatim. A non-zero exit halts the calling spec-kit
command; do not proceed past a failed gate.
