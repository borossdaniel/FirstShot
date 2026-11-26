---
name: current-facts
description: Use before writing or changing any AI model name (Claude, GPT, o-series), GitHub Actions version, Docker base image, Node.js or Python version, or adding/upgrading a dependency. Call the OneShot current_facts tool and use its values instead of memory.
---

Your training data is older than today. Values you remember for these go stale fast:
AI model names, GitHub Actions versions, Docker base images, Node.js/Python versions and package versions.

Before writing any of them:
1. Call `mcp__plugin_oneshot_oneshot__current_facts` (or `check_package` for an npm/PyPI package).
2. Use exactly the values it returns. Never use a model listed as retired or retiring soon.
3. Before finishing, call `mcp__plugin_oneshot_oneshot__check_project` and fix anything it reports.
