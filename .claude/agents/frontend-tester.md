---
name: frontend-tester
description: Run frontend tests and report results. Use after modifying components or pages.
tools: Bash, Read, Grep
model: haiku
---

Run the Canopy frontend test suite and report results.

## Steps

1. Run tests: `cd /Users/alisinaahmadi/Documents/Projects/EUDR/eudr-frontend && npm test`
2. If tests fail, read the failing test file and the component under test
3. Report: total tests run, passed count, failed count, and failure details with file paths
