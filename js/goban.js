/* Goban — 围棋规则引擎（气、提子、自杀禁着、打劫、数目）
 * 纯逻辑，不依赖 DOM；可在浏览器或 Node 中运行。
 * 棋盘用一维数组表示：board[y*size + x]，取值 0=空 / 1=黑 / 2=白。
 * 坐标 (x,y) 均为 0 起；x 向右递增，y 向上递增（即 y=0 为底边）。
 */
(function (global) {
  'use strict';

  var EMPTY = 0, BLACK = 1, WHITE = 2;

  function opponent(c) { return c === BLACK ? WHITE : BLACK; }

  function Goban(size) {
    this.size = size || 9;
    this.reset();
  }

  Goban.EMPTY = EMPTY;
  Goban.BLACK = BLACK;
  Goban.WHITE = WHITE;

  Goban.prototype.reset = function () {
    var n = this.size * this.size;
    this.board = new Array(n).fill(EMPTY);
    this.turn = BLACK;
    this.captures = { 1: 0, 2: 0 };
    this.koPoint = -1;
    this.lastMove = -1;
    this.history = [];
  };

  Goban.prototype.index = function (x, y) { return y * this.size + x; };
  Goban.prototype.xOf = function (idx) { return idx % this.size; };
  Goban.prototype.yOf = function (idx) { return Math.floor(idx / this.size); };

  Goban.prototype.inBounds = function (x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  };

  // 某点上下左右的相邻点索引
  Goban.prototype.neighbors = function (idx) {
    var x = this.xOf(idx), y = this.yOf(idx), s = this.size, out = [];
    if (x > 0) out.push(idx - 1);
    if (x < s - 1) out.push(idx + 1);
    if (y > 0) out.push(idx - s);
    if (y < s - 1) out.push(idx + s);
    return out;
  };

  // 返回包含 idx 的同色棋串（stones 索引数组）及其气（liberties 空点索引数组）
  Goban.prototype.groupAndLiberties = function (idx, board) {
    board = board || this.board;
    var color = board[idx];
    if (color === EMPTY) return { stones: [], liberties: [] };
    var stack = [idx], seen = {}, stones = [], libSet = {}, libs = [];
    seen[idx] = true;
    while (stack.length) {
      var cur = stack.pop();
      stones.push(cur);
      var nb = this.neighbors(cur);
      for (var i = 0; i < nb.length; i++) {
        var n = nb[i];
        if (board[n] === EMPTY) {
          if (!libSet[n]) { libSet[n] = true; libs.push(n); }
        } else if (board[n] === color && !seen[n]) {
          seen[n] = true; stack.push(n);
        }
      }
    }
    return { stones: stones, liberties: libs };
  };

  Goban.prototype.liberties = function (idx, board) {
    return this.groupAndLiberties(idx, board).liberties;
  };

  // 在 (x,y) 落子（默认当前执子方）。返回结果对象。
  Goban.prototype.play = function (x, y, color) {
    color = color || this.turn;
    if (!this.inBounds(x, y)) return { ok: false, error: 'bounds', x: x, y: y, color: color };
    var idx = this.index(x, y);
    if (this.board[idx] !== EMPTY) return { ok: false, error: 'occupied', x: x, y: y, color: color };
    if (idx === this.koPoint) return { ok: false, error: 'ko', x: x, y: y, color: color };

    var snapshot = {
      board: this.board.slice(),
      turn: this.turn,
      captures: { 1: this.captures[1], 2: this.captures[2] },
      koPoint: this.koPoint,
      lastMove: this.lastMove
    };

    var sim = this.board.slice();
    sim[idx] = color;

    // 1) 提掉相邻的无气对方棋串
    var opp = opponent(color);
    var capturedSet = {};
    var nb = this.neighbors(idx);
    for (var i = 0; i < nb.length; i++) {
      var n = nb[i];
      if (sim[n] === opp) {
        var g = this.groupAndLiberties(n, sim);
        if (g.liberties.length === 0) {
          for (var k = 0; k < g.stones.length; k++) capturedSet[g.stones[k]] = true;
        }
      }
    }
    var captured = Object.keys(capturedSet).map(Number);
    for (i = 0; i < captured.length; i++) sim[captured[i]] = EMPTY;

    // 2) 检查己方棋串是否仍有气（否则为自杀禁着）
    var own = this.groupAndLiberties(idx, sim);
    if (own.liberties.length === 0) {
      return { ok: false, error: 'suicide', x: x, y: y, color: color };
    }

    // 3) 打劫判定：恰好提一子、且落子后己方为单子单气 -> 对方不可立即回提
    var newKo = -1;
    if (captured.length === 1 && own.stones.length === 1 && own.liberties.length === 1) {
      newKo = captured[0];
    }

    this.board = sim;
    this.captures[color] += captured.length;
    this.koPoint = newKo;
    this.lastMove = idx;
    this.turn = opp;
    this.history.push(snapshot);
    return { ok: true, captured: captured, color: color, x: x, y: y, ko: newKo >= 0 };
  };

  Goban.prototype.undo = function () {
    if (!this.history.length) return false;
    var st = this.history.pop();
    this.board = st.board;
    this.turn = st.turn;
    this.captures = st.captures;
    this.koPoint = st.koPoint;
    this.lastMove = st.lastMove;
    return true;
  };

  Goban.prototype.pass = function () {
    this.history.push({
      board: this.board.slice(),
      turn: this.turn,
      captures: { 1: this.captures[1], 2: this.captures[2] },
      koPoint: this.koPoint,
      lastMove: this.lastMove
    });
    this.koPoint = -1;
    this.turn = opponent(this.turn);
    return true;
  };

  // 数目（按面积法：子 + 只被单方围住的空）。komi 为贴目，默认 6.5。
  Goban.prototype.score = function (komi) {
    if (komi == null) komi = 6.5;
    var areaB = 0, areaW = 0;
    var visited = new Array(this.board.length).fill(false);
    for (var i = 0; i < this.board.length; i++) {
      var c = this.board[i];
      if (c === BLACK) areaB++;
      else if (c === WHITE) areaW++;
      else if (!visited[i]) {
        var stack = [i], seen = {}, region = [];
        seen[i] = true;
        var touchesB = false, touchesW = false;
        while (stack.length) {
          var cur = stack.pop();
          region.push(cur);
          var nb = this.neighbors(cur);
          for (var k = 0; k < nb.length; k++) {
            var n = nb[k], nc = this.board[n];
            if (nc === EMPTY && !seen[n]) { seen[n] = true; stack.push(n); }
            else if (nc === BLACK) touchesB = true;
            else if (nc === WHITE) touchesW = true;
          }
        }
        for (k = 0; k < region.length; k++) visited[region[k]] = true;
        if (touchesB && !touchesW) areaB += region.length;
        else if (touchesW && !touchesB) areaW += region.length;
      }
    }
    var result = areaB - (areaW + komi);
    return {
      black: areaB, white: areaW, komi: komi,
      result: result,
      winner: result > 0 ? BLACK : (result < 0 ? WHITE : 0)
    };
  };

  // 把一批坐标（"D4" 之类围棋坐标字符串数组）摆到棋盘上
  Goban.prototype.setup = function (blackStrs, whiteStrs) {
    this.reset();
    var self = this;
    (blackStrs || []).forEach(function (s) { var p = parseCoord(s, self.size); if (p) self.board[self.index(p.x, p.y)] = BLACK; });
    (whiteStrs || []).forEach(function (s) { var p = parseCoord(s, self.size); if (p) self.board[self.index(p.x, p.y)] = WHITE; });
    return this;
  };

  // 围棋坐标 "D4" -> {x,y}（列字母跳过 I，行号自底边起）
  function colToX(letter) {
    var c = letter.toUpperCase().charCodeAt(0) - 65; // A=0
    if (c >= 8) c -= 1; // 跳过 I
    return c;
  }
  function parseCoord(str, size) {
    if (typeof str !== 'string') return null;
    var m = /^\s*([A-Za-z])(\d{1,2})\s*$/.exec(str);
    if (!m) return null;
    var x = colToX(m[1]);
    var num = parseInt(m[2], 10);
    var y = num - 1; // 行号 1 位于底边
    if (x < 0 || x >= size || y < 0 || y >= size) return null;
    return { x: x, y: y, n: num };
  }
  Goban.parseCoord = parseCoord;

  // 反向：{x,y} -> 围棋坐标字符串（用于显示）
  function coordToStr(x, y, size) {
    var letters = 'ABCDEFGHJKLMNOPQRST';
    return (letters[x] || '?') + (y + 1);
  }
  Goban.coordToStr = coordToStr;

  Goban.EMPTY = EMPTY;
  Goban.BLACK = BLACK;
  Goban.WHITE = WHITE;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Goban;
  } else {
    global.Goban = Goban;
  }
})(typeof window !== 'undefined' ? window : this);
