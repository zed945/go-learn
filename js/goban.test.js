// 围棋引擎规则自测（node goban.test.js）
'use strict';
var Goban = require('./goban.js');
var BLACK = Goban.BLACK, WHITE = Goban.WHITE;

var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ok  ' + msg); }
  else { failed++; console.log('FAIL  ' + msg); }
}

function setup(size, black, white, turn) {
  var g = new Goban(size);
  g.setup(black, white);
  if (turn) g.turn = turn;
  return g;
}

function playCoord(g, str, color) {
  var p = Goban.parseCoord(str, g.size);
  return g.play(p.x, p.y, color);
}

console.log('== 1. 气 ==');
var g1 = setup(9, ['E5'], []);
assert(g1.liberties(g1.index(4, 4)).length === 4, '中腹单子 4 气');
var g1b = setup(9, ['E1'], []);
assert(g1b.liberties(g1b.index(4, 0)).length === 3, '边单子 3 气');
var g1c = setup(9, ['A1'], []);
assert(g1c.liberties(g1c.index(0, 0)).length === 2, '角单子 2 气');
var g1d = setup(9, ['E5', 'F5'], []);
assert(g1d.liberties(g1d.index(4, 4)).length === 6, '两子相连 6 气');

console.log('== 2. 提一子 ==');
var g2 = setup(9, ['D5', 'F5', 'E4'], ['E5'], BLACK);
var r2 = playCoord(g2, 'E6');
assert(r2.ok && r2.captured.length === 1, '黑下 E6 提掉白 E5');
assert(g2.board[g2.index(4, 4)] === Goban.EMPTY, '白 E5 已被提走');

console.log('== 3. 提多子 ==');
var g3 = setup(9, ['D4', 'D5', 'F4', 'F5', 'E3'], ['E4', 'E5'], BLACK);
var r3 = playCoord(g3, 'E6');
assert(r3.ok && r3.captured.length === 2, '黑下 E6 一次提掉两颗白子');

console.log('== 4. 自杀禁着 ==');
var g4 = setup(9, ['A2'], ['B1', 'B2', 'A3']);
var r4 = g4.play(0, 0); // A1
assert(!r4.ok && r4.error === 'suicide', '黑 A1 为自杀禁着');

console.log('== 5. 打劫 ==');
var g5 = setup(9, ['B2', 'A3', 'B4'], ['C2', 'B3', 'C4', 'D3'], BLACK);
var r5 = g5.play(2, 2); // C3 提劫
assert(r5.ok && r5.captured.length === 1 && r5.ko === true, '黑 C3 提劫成功');
assert(g5.koPoint === g5.index(1, 2), '劫点指向被提的 B3');
var r5b = g5.play(1, 2); // 白立即回提 B3
assert(!r5b.ok && r5b.error === 'ko', '白不能立即回提（打劫）');

console.log('== 6. 普通提子不误判为劫 ==');
var g6 = setup(9, ['D5', 'F5', 'E4'], ['E5'], BLACK);
var r6 = playCoord(g6, 'E6'); // 提 E5
assert(r6.ok && r6.ko === false && g6.koPoint === -1, '普通提子不是劫');

console.log('== 7. 数目 ==');
var g7 = setup(9, ['C3', 'D3', 'C4', 'D4', 'C5', 'D5', 'C6', 'D6'], ['G3', 'H3', 'G4', 'H4', 'G5', 'H5', 'G6', 'H6']);
var s7 = g7.score(0);
assert(s7.black >= 8 && s7.white >= 8, '围空可被统计（黑' + s7.black + ' 白' + s7.white + '）');

console.log('== 8. 撤销 ==');
var g8 = setup(9, [], []);
g8.play(4, 4);
g8.play(4, 3);
g8.undo();
assert(g8.board[g8.index(4, 3)] === Goban.EMPTY && g8.turn === WHITE, 'undo 恢复上一手');

console.log('== 9. 做活（两眼）==');
var g9 = setup(9, ['A9','C9','A8','C8','A7','C7','A6','B6','C6','A5','B5','C5'], [], BLACK);
var r9 = playCoord(g9, 'B8');
assert(r9.ok, '黑 B8 落子合法（做出两只眼）');
var wB7 = playCoord(g9, 'B7', WHITE);
var wB9 = playCoord(g9, 'B9', WHITE);
assert(!wB7.ok && wB7.error === 'suicide', '白 B7 是眼（自杀）');
assert(!wB9.ok && wB9.error === 'suicide', '白 B9 是眼（自杀）');

console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed ? 1 : 0);
