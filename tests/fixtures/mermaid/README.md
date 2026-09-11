# External Mermaid regression fixture

`official-large-flowchart.mmd` is the unmodified `flowchart TD` system/environment
example extracted from the official Mermaid demo page on 2026-09-11:

https://github.com/mermaid-js/mermaid/blob/develop/demos/flowchart.html

The diagram contains 22 explicitly declared nodes and 40 directed relationships.
It exercises long identifiers, labels with Font Awesome markers, backslashes,
bracketed database paths, fan-out, shared dependencies, and cross-layer edges.
The adjacent LICENSE is the upstream MIT license.

A manual end-to-end test imported this file using the home page file chooser at
http://localhost:3500. All IDs, labels, and relationship endpoints matched the
source. All 22 cards and 40 relationships were placed in the view, with positive
card dimensions, finite coordinates, and no card overlaps. Reloading preserved the
model and layout; selecting an element opened its inspector. No browser errors or
model validation errors were observed. The validator reported 40 missing relation
descriptions, matching the unlabeled edges in the original. Font Awesome markers
remain literal label text rather than rendered icons.

The automated regression test is `tests/mermaid-external-example.test.ts` and runs
entirely offline against an in-memory database.
