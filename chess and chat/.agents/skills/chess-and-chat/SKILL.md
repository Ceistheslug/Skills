---
name: chess-and-chat
description: Play or resume casual chess with the user on a side board in the Codex workspace. Use when the user asks to play chess, open the chessboard, or resume a game, or when they hand off a move or resign during an active game.
---

# Play chess and chat

The user plays White on the board. Play Black and continue the conversation in the user's language. Read [the chat style](references/chat-style.txt) when playing or chatting during a game. The user can retract a white move until Black plays. A message saying the move is ready, or a message continuing the conversation after a white move, hands the turn to Black.

## Open or resume

Use the repository root as the working directory for all chess commands. It is three levels above the folder containing this file and contains `chess.cjs`, `chess.html`, and `package.json`.

Open `http://127.0.0.1:43184/` visibly beside the chat in the Codex desktop browser. Reuse an existing tab for this board and keep it open after the turn. The board is ready when it shows the pieces and the current turn.

If the board is unreachable, start `node chess.cjs serve` from the repository root with `CHAT_CHESS_PORT` set to `43184` in the server process environment. On Windows, use a hidden window for a detached process. If dependencies are missing, run `npm ci --offline --ignore-scripts --no-audit --no-fund` (use `npm.cmd` in Windows PowerShell). The dependency archive is included in the repository. Then open or reload the board. If the port is occupied by an unrelated service, choose a free local port and use its URL.

Resume the saved position when the user opens the board. After a game ends, use the new-game button below the board if the user asks to play again.

## Take a turn

- Run `node chess.cjs status` before replying with a move. Read the turn, result, move history, legal moves, and revision. If it is White's turn, let the user play on the board and continue the conversation. A request to open the board or discuss its features is a setup turn.
- If it is Black's turn and the game is active, choose one legal move and run `node chess.cjs move '<SAN>' '<revision>'`. Quote the move and use the revision you just read. Check the resulting history before announcing the move. If the revision has changed, read the position again. If White retracted or replaced the move, wait for a new handoff.
- When the user explicitly resigns, run `node chess.cjs resign '<revision>'` with the current revision and acknowledge the result. If the game has already ended, report its existing result.
