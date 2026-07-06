# Workflow Preferences

## Bugfix Specs — Per-Bug Sequential Tasks

When creating implementation tasks for bugfix specs that contain multiple bugs, structure the task list **per-bug sequentially** — not by phase across all bugs.

Each bug should be a self-contained cycle:
1. Exploration test (confirm bug exists on unfixed code — test fails)
2. Preservation test (capture baseline behavior on unfixed code — test passes)
3. Fix + verify (implement fix, re-run exploration test passes, preservation still passes)
4. Checkpoint (confirm everything green for that bug)

Complete one bug fully before starting the next. The Task Dependency Graph waves should reflect this: one bug at a time, not all bugs in parallel.
