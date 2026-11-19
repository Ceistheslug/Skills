# Chess and Chat

Play chess with Codex while you chat. You play White on a chessboard beside the conversation, and Codex plays Black. After moving, say “Your turn” or just keep chatting. Codex will reply and make its move on the same board.

You can take back your latest move before Codex makes its move, close the board and resume later, or resign by saying so in chat. The board interface is in Traditional Chinese, and Codex chats in your language.

You can customize the chat style by editing [`chat-style.txt`](.agents/skills/chess-and-chat/references/chat-style.txt). The default has a warm, mature, slightly protective big-sister vibe. Yeah, I know...

<img width="1871" height="989" alt="how it look like" src="https://github.com/user-attachments/assets/bbef12ff-7aa5-4e36-9888-270e7fab85fc" />

## Installation

You’ll need the **Codex desktop app** and **Node.js with npm**. This project was tested on Windows with Node.js 22.

1. Clone this repository, or choose **Code → Download ZIP** on GitHub and extract it.
2. Open the downloaded folder in Codex. Choose the folder that contains `chess.cjs` and `package.json`. Codex will find the skill in `.agents/skills/chess-and-chat/`.
3. Install the dependencies from a terminal in that folder. The dependency archive is included, so this step works offline.

   ```sh
   npm ci --offline --ignore-scripts --no-audit --no-fund
   ```

   If PowerShell blocks `npm` on Windows, use `npm.cmd` with the same arguments.

4. Type `$chess-and-chat` in the Codex chat, or type `/` and select **chess-and-chat** from the menu. Codex will open the board beside the chat. White moves first.
