---
name: harness-verify
description: "Run the active spec-kit plan's verify command."
disable-model-invocation: true
---

Run:

```bash
python3 scripts/harness/speckit_gate.py verify
```

Report the command output verbatim. A non-zero exit halts the calling spec-kit
command; do not proceed past failed verification.
