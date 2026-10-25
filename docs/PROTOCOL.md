# Crapette Engine Protocol (PROTOCOL = 1)

The engine holds all game rules and state transitions; frontends (Web3D, CLI, bots) render state and send commands.

## Architecture
- **State**: Serialized JSON describing current board layout, active player, card positions, legal moves, and game status.
- **Commands**: Terse, deterministic one-line string instructions sent to `engine.send(command)`.

## Commands
| Command | Format | Example | Description |
|---|---|---|---|
| Move Card | `m <src>><dst>` | `m r>h` | Moves card from source slot to destination slot |
| Draw Stock | `draw` | `draw` | Turns the top card of the active player's Hand (Stock) |
| Discard / End | `waste` | `waste` | Places current turned Stock card to Waste and passes turn |
| Call Crapette | `crapette` | `crapette` | Opponent claims a blunder on active player |
| Undo Move | `undo` | `undo` | Reverts the last non-stock move in the current turn |
| Request Hint | `hint` | `hint` | Generates recommended tactical move |

### Slot Identifiers
- `r` / `r0` (Player 0 Reserve), `r1` (Player 1 Reserve)
- `w` / `w0` (Player 0 Waste), `w1` (Player 1 Waste)
- `s` / `s0` (Player 0 Stock), `s1` (Player 1 Stock)
- `t0` .. `t7` (Tableau columns 0 through 7)
- `h` / `h0` .. `h7` (Foundations 0 through 7; or simply `h` for auto-matching foundation)

## State Structure
```json
{
  "protocol": 1,
  "prompt": "play",
  "active": 0,
  "seed": 12345,
  "mode": "competitive",
  "tableau": [
    ["KD", "QS"],
    [],
    ["7H"]
  ],
  "foundations": [
    ["AS", "2S"],
    [],
    ...
  ],
  "players": [
    {
      "deck": "red",
      "reserve_count": 12,
      "reserve_top": "9D",
      "stock_count": 35,
      "stock_drawn": null,
      "waste": ["5C"],
      "score": 0
    },
    {
      "deck": "blue",
      "reserve_count": 13,
      "reserve_top": "JH",
      "stock_count": 35,
      "stock_drawn": null,
      "waste": [],
      "score": 0
    }
  ],
  "legal": [
    "m r>h",
    "m t0>t2",
    "draw"
  ],
  "compulsory": [
    "m r>h"
  ],
  "crapette_eligible": false,
  "undoable": true,
  "winner": null
}
```
