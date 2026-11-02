// AI 自测（node ai.test.js）
'use strict';
var Goban = require('./goban.js');
var GobanAI = require('./ai.js');
var BLACK = Goban.BLACK, WHITE = Goban.WHITE;

var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ok  ' + msg); }
  else { failed++; console.log('FAIL  ' + msg); }
}

// 1. 明显能提子时，AI 应选提子点
var g1 = new Goban(9);
g1.setup(['D5', 'F5', 'E4'], ['E5']);
g1.turn = BLACK;
var mv1 = GobanAI.aiMove(g1, BLACK);
assert(mv1 && mv1.x === 4 && mv1.y === 5, 'AI 黑棋选 E6 提掉白 E5（got ' + JSON.stringify(mv1) + '）');

// 2. 空棋盘：AI 应落在合法点（倾向于角）
var g2 = new Goban(9);
var mv2 = GobanAI.aiMove(g2, BLACK);
assert(mv2 && g2.board[g2.index(mv2.x, mv2.y)] === Goban.EMPTY, '空棋盘 AI 给出合法落点 ' + JSON.stringify(mv2));
var isCorner = (mv2.x === 0 || mv2.x === 8) && (mv2.y === 0 || mv2.y === 8);
assert(isCorner, '开局占角 ' + JSON.stringify(mv2));

// 3. 无空点：AI 返回 null（停一手）
var g3 = new Goban(9);
for (var i = 0; i < g3.board.length; i++) g3.board[i] = BLACK;
assert(GobanAI.aiMove(g3, BLACK) === null, '满盘 AI 返回 null（停一手）');

// 4. 自己的棋被打吃时，AI 优先逃（白 E5 只剩一口气，白应下 E6 延气）
var g4 = new Goban(9);
g4.setup(['D5', 'F5', 'E4'], ['E5']);
g4.turn = WHITE;
var mv4 = GobanAI.aiMove(g4, WHITE);
assert(mv4 && mv4.x === 4 && mv4.y === 5, '白棋被打吃时 AI 选 E6 逃（got ' + JSON.stringify(mv4) + '）');

// 5. 打劫点被禁止时 AI 不违规
var g5 = new Goban(9);
g5.setup(['B2', 'A3', 'B4'], ['C2', 'B3', 'C4', 'D3']);
g5.turn = BLACK;
var r = g5.play(2, 2); // 黑 C3 提劫，形成劫，劫点在 B3
assert(r.ok, '黑 C3 提劫');
var mv5 = GobanAI.aiMove(g5, WHITE);
assert(!(mv5 && mv5.x === 1 && mv5.y === 2), '白 AI 不立即回提劫点 B3（got ' + JSON.stringify(mv5) + '）');

console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed ? 1 : 0);
