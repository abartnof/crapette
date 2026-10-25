# Standing Rules

- **Test-driven development (TDD)**: Write the test first, verify that it fails for the expected reason, then write the implementation to make it pass.
- **Atomic commits, often**: Each commit is a single logical unit of change with clear intent, accompanied by passing tests and updated documentation.
- **The engine holds the rules; clients hold none**: The core game engine enforces all rules, validity, transitions, and state representation. UI/frontends strictly render state and dispatch user intent as commands.
- **Deterministic and reproducible**: Pure functions where possible; random operations are seeded and partitioned by purpose streams.
