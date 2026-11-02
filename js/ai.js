/* GobanAI — 一个轻量围棋陪练 AI（纯启发式，离线可用）
 * 思路：遍历所有合法落点，按“提子 > 逃自己被打吃的棋 > 打吃对方 > 接触/占角”打分选最优。
 * 供“人机对弈”和“提示下一手”使用。不追求棋力，只求对初学者友好、不犯低级错误。
 */
(function (global) {
  'use strict';

  var Goban = (typeof require !== 'undefined') ? require('./goban.js') : global.Goban;
  var EMPTY = Goban.EMPTY, BLACK = Goban.BLACK, WHITE = Goban.WHITE;

  function opponent(c) { return c === BLACK ? WHITE : BLACK; }

  function stoneCount(g) {
    var c = 0;
    for (var i = 0; i < g.board.length; i++) if (g.board[i] !== EMPTY) c++;
    return c;
  }

  // 模拟在 (x,y) 落子，返回 {g: 新棋盘, res: 落子结果}；非法则 res.ok=false
  function cloneForPlay(goban, x, y, color) {
    var g = new Goban(goban.size);
    g.board = goban.board.slice();
    g.turn = color;
    g.captures = { 1: goban.captures[1], 2: goban.captures[2] };
    g.koPoint = goban.koPoint;
    g.lastMove = goban.lastMove;
    var res = g.play(x, y, color);
    return { g: g, res: res };
  }

  // 统计某方“只剩一口气”的棋块数量（被打吃的块数）
  function countAtari(g, color) {
    var seen = {}, count = 0;
    for (var i = 0; i < g.board.length; i++) {
      if (g.board[i] !== color || seen[i]) continue;
      var grp = g.groupAndLiberties(i);
      for (var k = 0; k < grp.stones.length; k++) seen[grp.stones[k]] = true;
      if (grp.liberties.length === 1) count++;
    }
    return count;
  }

  // 周边（切比雪夫距离 ≤2）已有棋子数，衡量“靠近战斗”
  function countNear(g, x, y) {
    var c = 0, size = g.size;
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        var nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (g.board[g.index(nx, ny)] !== EMPTY) c++;
      }
    }
    return c;
  }

  // 越靠近角越高（金角银边草肚皮）
  function cornerBonus(x, y, size) {
    var dx = Math.min(x, size - 1 - x);
    var dy = Math.min(y, size - 1 - y);
    return (size - (dx + dy)) * 3;
  }

  function scoreMove(orig, sim, x, y, color, selfAtariBefore) {
    var g = sim.g, res = sim.res;
    var score = 0;

    score += res.captured.length * 100;      // 提子最优先
    if (res.ko) score += 12;

    var idx = g.index(x, y);
    var own = g.groupAndLiberties(idx);
    var ownLibs = own.liberties.length;
    if (res.captured.length === 0 && ownLibs === 1) score -= 30; // 避免自紧气（自杀点已被引擎排除）

    score += ownLibs * 0.8;                  // 气多更舒展
    if (res.captured.length === 0) score += countAtari(g, opponent(color)) * 20; // 打吃对方

    var selfAtariAfter = countAtari(g, color);
    score += (selfAtariBefore - selfAtariAfter) * 40; // 救自己被打吃的棋

    var contact = 0, nb = g.neighbors(idx);
    for (var i = 0; i < nb.length; i++) if (g.board[nb[i]] !== EMPTY) contact++;
    score += contact * 3;

    score += countNear(g, x, y) * 1.0;

    if (stoneCount(g) < 10) score += cornerBonus(x, y, g.size); // 开局占角

    score += Math.random() * 2.5;            // 轻微随机，增加变化
    return score;
  }

  // 返回建议落点 {x,y}，无棋可下返回 null（表示停一手）
  function aiMove(goban, color) {
    color = color || goban.turn;
    var size = goban.size;
    var selfAtariBefore = countAtari(goban, color);
    var best = null, bestScore = -Infinity;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var idx = goban.index(x, y);
        if (goban.board[idx] !== EMPTY) continue;
        if (idx === goban.koPoint) continue;
        var sim = cloneForPlay(goban, x, y, color);
        if (!sim.res.ok) continue;
        var sc = scoreMove(goban, sim, x, y, color, selfAtariBefore);
        if (sc > bestScore) { bestScore = sc; best = { x: x, y: y }; }
      }
    }
    return best;
  }

  var GobanAI = { aiMove: aiMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = GobanAI;
  else global.GobanAI = GobanAI;
})(typeof window !== 'undefined' ? window : this);
