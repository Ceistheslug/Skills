const { createServer } = require('node:http');
const { readFileSync, writeFileSync, renameSync, unlinkSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { Chess } = require('chess.js');

const port = Number(process.env.CHAT_CHESS_PORT || 43183);
const address = `127.0.0.1:${port}`;
const baseUrl = `http://${address}`;
const savePath = process.env.CHAT_CHESS_SAVE || join(__dirname, 'game.json');
const replyPath = `${savePath}.reply`;
const resignationResult = '你已認輸 · 黑棋勝';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function writeJson(path, value) {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value));
  renameSync(tempPath, path);
}

function loadGame() {
  const saved = readJson(savePath);
  const game = new Chess();
  if (saved) game.loadPgn(saved.moves);
  const id = saved?.id || randomUUID();
  const revision = saved?.revision ?? `${id}:${game.history().length}`;
  return { game, id, revision, resigned: saved?.resigned === true, saved: Boolean(saved) };
}

function resultOf(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? '將死，我贏了' : '將死，你贏了';
  if (game.isStalemate()) return '逼和';
  if (game.isInsufficientMaterial()) return '和棋 · 棋子不足';
  if (game.isThreefoldRepetition()) return '和棋 · 局面三次重複';
  if (game.isDrawByFiftyMoves()) return '和棋 · 五十步規則';
  return null;
}

function snapshot(game, revision, resigned) {
  const result = resigned ? resignationResult : resultOf(game);
  const moves = game.history({ verbose: true }).map(({ from, to, san }) => ({ from, to, san }));
  return {
    revision,
    fen: game.fen(),
    board: game.board().flat(),
    turn: game.turn(),
    check: game.inCheck(),
    result,
    canUndo: !resigned && game.turn() === 'b' && moves.length > 0,
    moves,
    legal: result ? [] : game.moves({ verbose: true })
      .map(({ from, to, promotion, san }) => ({ from, to, promotion, san })),
  };
}

function serve() {
  const html = readFileSync(join(__dirname, 'chess.html'));
  let { game, id, revision, resigned, saved } = loadGame();
  let state = snapshot(game, revision, resigned);

  function save() {
    const nextState = snapshot(game, randomUUID(), resigned);
    writeJson(savePath, { id, revision: nextState.revision, moves: game.pgn(), resigned });
    state = nextState;
  }

  function play(move) {
    game.move(move);
    try {
      save();
    } catch (error) {
      game.undo();
      throw error;
    }
  }

  async function respond(request, response) {
    const send = (status, value, type = 'application/json; charset=utf-8') => {
      response.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
    };
    const host = request.headers.host;
    const localHost = `localhost:${port}`;
    if (host !== address && host !== localHost) return send(403, { error: '請從本機開啟棋盤。' });
    const route = request.url;
    if (request.method === 'GET') {
      if (route === '/') return send(200, html, 'text/html; charset=utf-8');
      if (route === '/state') return send(200, state);
    }
    if (request.method !== 'POST' || !['/white', '/undo', '/rematch'].includes(route)) {
      return send(404, { error: '找不到頁面。' });
    }
    const origin = request.headers.origin;
    if (origin !== `http://${host}`) {
      return send(403, { error: '這個頁面無法操作此棋盤。' });
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      return send(415, { error: '無法讀取走法。' });
    }

    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 2048) return send(413, { error: '走法資料太長。' });
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return send(400, { error: '無法讀取走法。' });
    }
    if (data?.revision !== state.revision) {
      return send(409, { error: '棋局已更新，請再試一次。' });
    }
    if (route === '/undo') {
      if (!state.canUndo) return send(409, { error: '已經無法撤回這步棋。' });
      const move = game.undo();
      try {
        save();
      } catch (error) {
        game.move(move);
        throw error;
      }
      return send(200, state);
    }
    if (route === '/rematch') {
      if (!state.result) return send(409, { error: '這一局還沒結束。' });
      const previous = { game, id, resigned };
      game = new Chess();
      id = randomUUID();
      resigned = false;
      try {
        save();
      } catch (error) {
        ({ game, id, resigned } = previous);
        throw error;
      }
      return send(200, state);
    }

    if (state.result || state.turn !== 'w') return send(409, { error: '現在不能走這一步。' });
    const move = state.legal.find(candidate => candidate.from === data.from && candidate.to === data.to
      && candidate.promotion === data.promotion);
    if (!move) return send(422, { error: '這步棋不符合規則。' });
    play(move);
    send(200, state);
  }

  const server = createServer((request, response) => {
    respond(request, response).catch((error) => {
      console.error(error);
      if (response.headersSent) return response.destroy();
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: '儲存棋局失敗，請再試一次。' }));
    });
  });
  server.listen(port, '127.0.0.1', () => {
    if (!saved) save();
    console.log(baseUrl);
    const claimedPath = `${replyPath}.${process.pid}`;
    setInterval(() => {
      try {
        renameSync(replyPath, claimedPath);
      } catch (error) {
        if (error.code !== 'ENOENT') console.error(error);
        return;
      }
      try {
        const reply = readJson(claimedPath);
        if (!reply || reply.expires <= Date.now() || reply.revision !== state.revision || state.result) return;
        if (reply.action === 'resign') {
          resigned = true;
          try {
            save();
          } catch (error) {
            resigned = false;
            throw error;
          }
        } else if (reply.action === 'move' && state.turn === 'b') {
          const move = state.legal.find(candidate => candidate.san === reply.move);
          if (move) play(move);
        }
      } catch (error) {
        console.error(error);
      } finally {
        try {
          unlinkSync(claimedPath);
        } catch (error) {
          console.error(error);
        }
      }
    }, 250).unref();
  });
}

async function command(action, move, expectedRevision) {
  const current = loadGame();
  if (!current.saved) throw new Error('Start the chessboard first.');
  let state = snapshot(current.game, current.revision, current.resigned);
  if (action !== 'status') {
    if (expectedRevision && expectedRevision !== state.revision) throw new Error('The position has changed.');
    if (state.result) throw new Error('The game has already ended.');
    if (action === 'move' && (state.turn !== 'b' || !state.legal.some(candidate => candidate.san === move))) {
      throw new Error('This is not a legal black move in the current position.');
    }
    const ply = state.moves.length;
    const expires = Date.now() + 4000;
    writeJson(replyPath, { action, revision: state.revision, move, expires });
    do {
      await delay(100);
      const updated = loadGame();
      state = snapshot(updated.game, updated.revision, updated.resigned);
      const applied = action === 'resign' ? updated.resigned : state.moves[ply]?.san === move;
      if (applied && updated.id === current.id) break;
      if (state.revision !== current.revision) throw new Error('The position has changed.');
    } while (Date.now() < expires + 250);
    if (state.revision === current.revision) throw new Error('The chessboard did not respond. Is the server running?');
  }
  const { revision, fen, turn, check, result, canUndo, moves, legal } = state;
  console.log(JSON.stringify({ revision, fen, turn, check, result, canUndo, moves: moves.map(m => m.san), legal: legal.map(m => m.san) }));
}

const [action = 'serve', firstArg, secondArg] = process.argv.slice(2);
if (action === 'serve') {
  serve();
} else if (action === 'status' || action === 'resign' || (action === 'move' && firstArg)) {
  const [move, expectedRevision] = action === 'resign' ? [null, firstArg] : [firstArg, secondArg];
  command(action, move, expectedRevision).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else {
  console.error('Usage: node chess.cjs [serve | status | move <SAN> [revision] | resign [revision]]');
  process.exitCode = 1;
}
