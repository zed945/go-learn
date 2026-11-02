/* 围棋入门应用：棋盘渲染、课程导航、进度记录、自由对弈 */
(function () {
  'use strict';

  var BLACK = Goban.BLACK, WHITE = Goban.WHITE, EMPTY = Goban.EMPTY;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var STORE_KEY = 'go-learn-progress-v1';
  var LETTERS = 'ABCDEFGHJKLMNOPQRST';

  // ---------- 基础 DOM 工具 ----------
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  // ---------- 进度存储 ----------
  var progress = loadProgress();
  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { lessons: {}, freeplay: { size: 9 } };
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function isLessonDone(id) { return !!progress.lessons[id]; }
  function setLessonDone(id, done) {
    if (done) progress.lessons[id] = true;
    else delete progress.lessons[id];
    saveProgress();
  }

  // ---------- 棋盘几何 ----------
  function starPoints(size) {
    if (size === 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]];
    if (size === 13) return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]];
    var e = size === 19 ? 3 : 3;
    var m = Math.floor(size / 2);
    var pts = [[e, e], [size - 1 - e, e], [e, size - 1 - e], [size - 1 - e, size - 1 - e]];
    if (size % 2 === 1) pts.push([m, m]);
    return pts;
  }

  var boardSeq = 0;
  function BoardView(container, opts) {
    opts = opts || {};
    this.container = container;
    this.size = opts.size || 9;
    this.showCoords = opts.showCoords !== false;
    this.goban = opts.goban || new Goban(this.size);
    this.onCellClick = opts.onCellClick || null;
    this.highlight = null; // {stones:[idx], liberties:[idx]}
    this.hint = null; // {x,y} 提示点
    this.marks = [];
    (opts.marks || []).forEach(function (s) {
      var p = Goban.parseCoord(s, this.size);
      if (p) this.marks.push(p);
    }, this);

    this.N = this.size;
    this.margin = this.showCoords ? 1.5 : 0.7;
    this.cell = 1;
    this.total = (this.N - 1) + this.margin * 2;
    this.stoneR = 0.46;
    this.uid = 'goban-' + (++boardSeq);

    this._build();
    this.render();
  }

  BoardView.prototype._build = function () {
    var self = this;
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + this.total + ' ' + this.total);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'board');
    this.svg = svg;

    // 背景
    var bg = this._el('rect', {
      x: 0, y: 0, width: this.total, height: this.total,
      rx: this.total * 0.02, fill: '#e2b96f'
    });
    svg.appendChild(bg);

    // 渐变
    var defs = this._el('defs', {});
    defs.innerHTML =
      '<radialGradient id="' + this.uid + '-b" cx="35%" cy="35%" r="65%">' +
      '<stop offset="0%" stop-color="#6a6a6a"/><stop offset="100%" stop-color="#0c0c0c"/></radialGradient>' +
      '<radialGradient id="' + this.uid + '-w" cx="35%" cy="35%" r="65%">' +
      '<stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#d4d4d4"/></radialGradient>';
    svg.appendChild(defs);

    // 网格线
    var lineCol = '#5a3a1e';
    for (var i = 0; i < this.N; i++) {
      var c = this.margin + i * this.cell;
      svg.appendChild(this._el('line', { x1: this.margin, y1: c, x2: this.margin + (this.N - 1), y2: c, stroke: lineCol, 'stroke-width': 0.03 }));
      svg.appendChild(this._el('line', { x1: c, y1: this.margin, x2: c, y2: this.margin + (this.N - 1), stroke: lineCol, 'stroke-width': 0.03 }));
    }

    // 星位
    starPoints(this.N).forEach(function (p) {
      var x = self.margin + p[0] * self.cell;
      var y = self._svgY(p[1]);
      svg.appendChild(self._el('circle', { cx: x, cy: y, r: 0.09, fill: lineCol }));
    });

    // 坐标标注
    if (this.showCoords) {
      var fs = 0.32;
      for (var x = 0; x < this.N; x++) {
        var lx = this.margin + x * this.cell;
        var t = this._el('text', { x: lx, y: this.total - 0.45, 'font-size': fs, 'text-anchor': 'middle', fill: '#5a3a1e' });
        t.textContent = LETTERS[x] || '';
        svg.appendChild(t);
      }
      for (var y = 0; y < this.N; y++) {
        var ly = this._svgY(y);
        var t2 = this._el('text', { x: 0.45, y: ly + 0.11, 'font-size': fs, 'text-anchor': 'middle', fill: '#5a3a1e' });
        t2.textContent = String(y + 1);
        svg.appendChild(t2);
      }
    }

    this.stonesG = this._el('g', {});
    this.marksG = this._el('g', {});
    this.hlG = this._el('g', {});
    svg.appendChild(this.stonesG);
    svg.appendChild(this.hlG);
    svg.appendChild(this.marksG);

    this.container.appendChild(svg);

    // 点击
    if (this.onCellClick) {
      svg.style.cursor = 'pointer';
      svg.addEventListener('click', function (evt) {
        var p = self._eventToGrid(evt);
        if (p) self.onCellClick(p.x, p.y);
      });
    }
  };

  BoardView.prototype._el = function (name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  BoardView.prototype._svgX = function (x) { return this.margin + x * this.cell; };
  BoardView.prototype._svgY = function (y) { return this.margin + (this.N - 1 - y) * this.cell; };

  BoardView.prototype._eventToGrid = function (evt) {
    var rect = this.svg.getBoundingClientRect();
    var px = (evt.clientX - rect.left) * (this.total / rect.width);
    var py = (evt.clientY - rect.top) * (this.total / rect.height);
    var x = Math.round((px - this.margin) / this.cell);
    var gy = Math.round((py - this.margin) / this.cell);
    var y = (this.N - 1) - gy;
    if (x < 0 || x >= this.N || y < 0 || y >= this.N) return null;
    return { x: x, y: y };
  };

  BoardView.prototype.render = function () {
    var self = this;
    clear(this.stonesG);
    clear(this.marksG);
    clear(this.hlG);

    var b = this.goban.board;
    for (var i = 0; i < b.length; i++) {
      if (b[i] === EMPTY) continue;
      var x = this.goban.xOf(i), y = this.goban.yOf(i);
      var col = b[i] === BLACK ? this.uid + '-b' : this.uid + '-w';
      var c = this._el('circle', {
        cx: this._svgX(x), cy: this._svgY(y), r: this.stoneR,
        fill: 'url(#' + col + ')'
      });
      if (b[i] === WHITE) c.setAttribute('stroke', '#9a9a9a');
      c.setAttribute('stroke-width', '0.02');
      this.stonesG.appendChild(c);
    }

    // 最后一手标记
    if (this.goban.lastMove >= 0) {
      var li = this.goban.lastMove;
      var dot = this._el('circle', {
        cx: this._svgX(this.goban.xOf(li)), cy: this._svgY(this.goban.yOf(li)),
        r: 0.14,
        fill: this.goban.board[li] === BLACK ? '#f4f4f4' : '#111'
      });
      this.stonesG.appendChild(dot);
    }

    // 高亮（气）
    if (this.highlight) {
      var self2 = this;
      this.highlight.liberties.forEach(function (li) {
        self2.hlG.appendChild(self2._el('circle', {
          cx: self2._svgX(self2.goban.xOf(li)), cy: self2._svgY(self2.goban.yOf(li)),
          r: 0.18, fill: '#3a9d4e', opacity: 0.9
        }));
      });
      this.highlight.stones.forEach(function (si) {
        self2.hlG.appendChild(self2._el('circle', {
          cx: self2._svgX(self2.goban.xOf(si)), cy: self2._svgY(self2.goban.yOf(si)),
          r: self2.stoneR + 0.08, fill: 'none', stroke: '#3a9d4e', 'stroke-width': 0.08
        }));
      });
    }

    // 标记点
    this.marks.forEach(function (m) {
      self.marksG.appendChild(self._el('circle', {
        cx: self._svgX(m.x), cy: self._svgY(m.y), r: 0.3,
        fill: 'none', stroke: '#e05a2a', 'stroke-width': 0.09
      }));
    });

    // 提示点
    if (this.hint) {
      this.hlG.appendChild(this._el('rect', {
        x: this._svgX(this.hint.x) - 0.18, y: this._svgY(this.hint.y) - 0.18,
        width: 0.36, height: 0.36, rx: 0.08, fill: '#e05a2a'
      }));
    }
  };

  // ---------- 各 section 渲染 ----------
  function renderSection(section, container) {
    var wrap = h('div', 'section');
    switch (section.type) {
      case 'text':
        if (section.title) wrap.appendChild(h('h3', 'section-title', section.title));
        section.body.forEach(function (p) { wrap.appendChild(h('p', 'para', p)); });
        break;

      case 'tip':
        var tip = h('div', 'tip');
        section.body.forEach(function (p) { tip.appendChild(h('p', null, p)); });
        wrap.appendChild(tip);
        break;

      case 'diagram':
        renderDiagram(section, wrap);
        break;

      case 'liberty':
        renderLiberty(section, wrap);
        break;

      case 'exercise':
        renderExercise(section, wrap);
        break;

      case 'score':
        renderScore(section, wrap);
        break;
    }
    container.appendChild(wrap);
  }

  function boardFigure(section, board, extraCtrl) {
    var fig = h('div', 'board-wrap');
    var bv = new BoardView(fig, {
      size: section.size,
      marks: section.marks,
      goban: board.goban
    });
    board.view = bv;
    if (section.caption) fig.appendChild(h('div', 'caption', section.caption));
    if (extraCtrl) fig.appendChild(extraCtrl);
    return fig;
  }

  function renderDiagram(section, container) {
    var g = new Goban(section.size);
    g.setup(section.black, section.white);
    container.appendChild(boardFigure(section, { goban: g }));
  }

  function renderLiberty(section, container) {
    var g = new Goban(section.size);
    g.setup(section.black, section.white);
    var fig = h('div', 'board-wrap');
    var bv = new BoardView(fig, { size: section.size, goban: g, onCellClick: onLibertyClick });
    function onLibertyClick(x, y) {
      var idx = g.index(x, y);
      if (g.board[idx] === EMPTY) { bv.highlight = null; }
      else {
        var grp = g.groupAndLiberties(idx);
        bv.highlight = { stones: grp.stones, liberties: grp.liberties };
      }
      bv.render();
    }
    if (section.caption) fig.appendChild(h('div', 'caption', section.caption));
    container.appendChild(fig);
  }

  function friendlyError(code) {
    if (code === 'occupied') return '这里已经有棋子了。';
    if (code === 'ko') return '打劫：不能立即回提，先到别处下一手。';
    if (code === 'suicide') return '这里是禁着点（自杀），不能下。';
    if (code === 'bounds') return '超出棋盘范围。';
    return '这一手不能下。';
  }

  function renderExercise(section, container) {
    var g = new Goban(section.size);
    g.setup(section.black, section.white);
    g.turn = section.color || BLACK;

    var wrap = h('div', 'exercise');
    wrap.appendChild(h('div', 'exercise-prompt', section.prompt));

    var fig = h('div', 'board-wrap');
    var solved = false;
    var bv = new BoardView(fig, { size: section.size, goban: g, onCellClick: onExClick });

    var fb = h('div', 'feedback');
    var hint = h('div', 'feedback-hint', '轮到' + (g.turn === BLACK ? '黑棋' : '白棋') + '，点击棋盘落子');

    function onExClick(x, y) {
      if (solved) return;
      var res = g.play(x, y);
      if (!res.ok) {
        fb.className = 'feedback error';
        fb.textContent = friendlyError(res.error);
        GobanSound.playWrong();
        return;
      }
      var coord = Goban.coordToStr(x, y, g.size);
      if (section.answer.indexOf(coord) >= 0) {
        solved = true;
        fb.className = 'feedback success';
        fb.textContent = section.success || '正确！';
        GobanSound.playCorrect();
        bv.render();
        if (section.explain) {
          var ex = h('p', 'feedback-explain', section.explain);
          fig.appendChild(ex);
        }
      } else {
        g.undo();
        fb.className = 'feedback error';
        fb.textContent = '这一手不能解决问题，再想想。';
        GobanSound.playWrong();
        bv.render();
      }
    }

    fig.appendChild(hint);
    wrap.appendChild(fig);
    wrap.appendChild(fb);
    container.appendChild(wrap);
  }

  function renderScore(section, container) {
    var g = new Goban(section.size);
    g.setup(section.black, section.white);
    var wrap = h('div', 'score-demo');

    var fig = h('div', 'board-wrap');
    new BoardView(fig, { size: section.size, goban: g });
    if (section.caption) fig.appendChild(h('div', 'caption', section.caption));

    var btn = h('button', 'btn', '数目');
    var result = h('div', 'score-result');

    btn.addEventListener('click', function () {
      var s = g.score(6.5);
      result.innerHTML = '';
      var line = '黑方：' + s.black + ' 目，白方：' + s.white + ' 目（贴 6.5 目）。';
      var verdict;
      if (s.winner === BLACK) verdict = '黑方胜 ' + s.result.toFixed(1) + ' 目';
      else if (s.winner === WHITE) verdict = '白方胜 ' + (-s.result).toFixed(1) + ' 目';
      else verdict = '平局';
      result.appendChild(h('p', null, line));
      result.appendChild(h('p', 'score-verdict', verdict));
    });

    var actions = h('div', 'score-actions');
    actions.appendChild(btn);
    wrap.appendChild(fig);
    wrap.appendChild(actions);
    wrap.appendChild(result);
    container.appendChild(wrap);
  }

  // ---------- 课程视图 ----------
  function renderLesson(index) {
    var view = document.getElementById('view-lesson');
    clear(view);
    var lesson = window.COURSE[index];

    var bread = h('div', 'breadcrumb');
    bread.appendChild(h('span', null, '第 ' + (index + 1) + ' 课'));
    view.appendChild(bread);

    var title = h('h2', 'lesson-title', lesson.title);
    view.appendChild(title);
    view.appendChild(h('p', 'lesson-summary', lesson.summary));

    var body = h('div', 'lesson-body');
    lesson.sections.forEach(function (s) { renderSection(s, body); });
    view.appendChild(body);

    // 要点
    if (lesson.keypoints && lesson.keypoints.length) {
      var kp = h('div', 'keypoints');
      kp.appendChild(h('div', 'keypoints-title', '本课要点'));
      var ul = h('ul', null);
      lesson.keypoints.forEach(function (k) { ul.appendChild(h('li', null, k)); });
      kp.appendChild(ul);
      view.appendChild(kp);
    }

    // 底部导航
    var nav = h('div', 'lesson-nav');
    if (index > 0) {
      var prev = h('button', 'btn', '← 上一课');
      prev.addEventListener('click', function () { showLesson(index - 1); window.scrollTo(0, 0); });
      nav.appendChild(prev);
    }
    var doneBtn = h('button', 'btn done-btn', isLessonDone(lesson.id) ? '✓ 已学完' : '标记本课完成');
    doneBtn.addEventListener('click', function () {
      var nowDone = !isLessonDone(lesson.id);
      setLessonDone(lesson.id, nowDone);
      if (nowDone) GobanSound.playDone();
      doneBtn.textContent = nowDone ? '✓ 已学完' : '标记本课完成';
      renderOutline();
      renderHomeProgress();
    });
    nav.appendChild(doneBtn);
    if (index < window.COURSE.length - 1) {
      var next = h('button', 'btn primary', '下一课 →');
      next.addEventListener('click', function () { showLesson(index + 1); window.scrollTo(0, 0); });
      nav.appendChild(next);
    }
    view.appendChild(nav);
  }

  // ---------- 首页 ----------
  function renderHomeProgress() {
    var el = document.getElementById('home-progress');
    if (!el) return;
    var done = 0;
    window.COURSE.forEach(function (l) { if (isLessonDone(l.id)) done++; });
    el.textContent = '已完成 ' + done + ' / ' + window.COURSE.length + ' 课';
  }

  function renderHome() {
    var view = document.getElementById('view-home');
    clear(view);

    var hero = h('div', 'hero');
    hero.appendChild(h('h1', null, '围棋入门'));
    hero.appendChild(h('p', null, '从零开始，循序渐进学会下围棋。'));
    var prog = h('div', 'hero-progress');
    prog.id = 'home-progress';
    hero.appendChild(prog);
    view.appendChild(hero);

    var grid = h('div', 'course-grid');
    window.COURSE.forEach(function (lesson, i) {
      var card = h('div', 'course-card');
      var num = h('div', 'lesson-num', String(i + 1).padStart(2, '0'));
      var title = h('div', 'course-title', lesson.title);
      var sum = h('div', 'course-summary', lesson.summary);
      if (isLessonDone(lesson.id)) card.classList.add('done');
      card.appendChild(num);
      card.appendChild(title);
      card.appendChild(sum);
      card.addEventListener('click', function () { showLesson(i); });
      grid.appendChild(card);
    });
    view.appendChild(grid);
    renderHomeProgress();
  }

  // ---------- 自由对弈 ----------
  var freeState = null;

  function renderFreeplay() {
    var view = document.getElementById('view-freeplay');
    clear(view);
    var size = progress.freeplay.size || 9;
    var mode = progress.freeplay.mode || 'two';          // 'two' 双人 | 'ai' 人机
    var userColor = progress.freeplay.userColor || BLACK;

    view.appendChild(h('h2', 'lesson-title', '自由对弈'));
    view.appendChild(h('p', 'lesson-summary', '在棋盘上随意下棋，练习提子、做眼。可切换人机对弈，让电脑陪你下。'));

    // 工具条
    var tools = h('div', 'freeplay-tools');
    tools.appendChild(h('span', 'tool-label', '棋盘：'));
    [9, 13, 19].forEach(function (s) {
      var b = h('button', 'btn size-btn' + (s === size ? ' active' : ''), s + ' 路');
      b.addEventListener('click', function () {
        progress.freeplay.size = s; saveProgress(); renderFreeplay();
      });
      tools.appendChild(b);
    });

    tools.appendChild(h('span', 'tool-label', ' 模式：'));
    [['two', '双人对弈'], ['ai', '人机对弈']].forEach(function (m) {
      var b = h('button', 'btn size-btn' + (m[0] === mode ? ' active' : ''), m[1]);
      b.addEventListener('click', function () {
        progress.freeplay.mode = m[0]; saveProgress(); renderFreeplay();
      });
      tools.appendChild(b);
    });

    var colorRow = h('span', 'color-row');
    if (mode === 'ai') {
      colorRow.appendChild(h('span', 'tool-label', ' 你执：'));
      [[BLACK, '黑（先）'], [WHITE, '白（后）']].forEach(function (c) {
        var b = h('button', 'btn size-btn' + (c[0] === userColor ? ' active' : ''), c[1]);
        b.addEventListener('click', function () {
          progress.freeplay.userColor = c[0]; saveProgress(); renderFreeplay();
        });
        colorRow.appendChild(b);
      });
    }
    tools.appendChild(colorRow);
    view.appendChild(tools);

    var g = new Goban(size);
    var wrap = h('div', 'freeplay-board');
    var status = h('div', 'status');
    var bv = new BoardView(wrap, { size: size, goban: g, onCellClick: onFreeClick });
    view.appendChild(wrap);
    view.appendChild(status);

    var scoreArea = h('div', 'score-result');
    view.appendChild(scoreArea);

    var aiColor = mode === 'ai' ? (userColor === BLACK ? WHITE : BLACK) : null;
    var aiThinking = false;
    var aiTimer = null;
    var consecutivePasses = 0;

    var controls = h('div', 'controls');
    function mkBtn(label, fn) {
      var b = h('button', 'btn', label);
      b.addEventListener('click', fn);
      controls.appendChild(b);
    }
    function cancelAi() {
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
      aiThinking = false;
    }
    mkBtn('悔棋', function () {
      cancelAi();
      g.undo();
      if (mode === 'ai' && g.turn === aiColor) g.undo();
      consecutivePasses = 0; refresh();
    });
    mkBtn('停一手', function () {
      if (aiThinking) return;
      g.pass(); consecutivePasses++;
      afterMove();
    });
    mkBtn('数目', showFreeScore);
    mkBtn('提示', function () {
      if (aiThinking) return;
      var mv = GobanAI.aiMove(g, g.turn);
      if (mv) {
        bv.hint = { x: mv.x, y: mv.y };
        bv.render();
        status.textContent = 'AI 建议：' + Goban.coordToStr(mv.x, mv.y, size);
      } else {
        status.textContent = '没有合适的点，建议停一手。';
      }
    });
    mkBtn('重新开始', function () {
      cancelAi();
      g.reset(); consecutivePasses = 0; clear(scoreArea); afterMove();
    });
    view.appendChild(controls);

    freeState = { g: g, bv: bv, status: status, scoreArea: scoreArea, size: size, mode: mode, userColor: userColor, aiColor: aiColor };

    function refresh() {
      bv.hint = null;
      bv.render();
      var cap = '黑提 ' + g.captures[BLACK] + ' 子 · 白提 ' + g.captures[WHITE] + ' 子';
      status.textContent = '轮到' + (g.turn === BLACK ? '黑棋' : '白棋') + '落子 · ' + cap;
    }
    function showFreeScore() {
      var s = g.score(6.5);
      clear(scoreArea);
      var verdict = s.winner === BLACK ? '黑方胜 ' + s.result.toFixed(1) + ' 目'
        : s.winner === WHITE ? '白方胜 ' + (-s.result).toFixed(1) + ' 目' : '平局';
      scoreArea.appendChild(h('p', null, '黑方 ' + s.black + ' 目 · 白方 ' + s.white + ' 目（贴 6.5 目）'));
      scoreArea.appendChild(h('p', 'score-verdict', verdict));
    }
    function afterMove() {
      // 当前方无合法落点时自动停一手
      while (consecutivePasses < 2 && !g.hasLegalMove(g.turn)) {
        g.pass();
        consecutivePasses++;
      }
      if (consecutivePasses >= 2) {
        bv.hint = null;
        bv.render();
        status.textContent = '双方停一手，对局结束。';
        showFreeScore();
      } else {
        refresh();
        maybeAi();
      }
    }
    function onFreeClick(x, y) {
      if (aiThinking) return;
      if (mode === 'ai' && g.turn === aiColor) return; // 等待电脑落子
      var res = g.play(x, y);
      if (!res.ok) { status.textContent = friendlyError(res.error); GobanSound.playWrong(); return; }
      consecutivePasses = 0;
      GobanSound.playStone();
      if (res.captured.length) GobanSound.playCapture();
      afterMove();
    }
    function maybeAi() {
      if (mode !== 'ai' || g.turn !== aiColor || aiThinking) return;
      aiThinking = true;
      status.textContent = '电脑思考中…';
      aiTimer = setTimeout(function () {
        aiTimer = null;
        var mv = GobanAI.aiMove(g, aiColor);
        if (mv) {
          var r = g.play(mv.x, mv.y); consecutivePasses = 0;
          GobanSound.playStone();
          if (r.captured.length) GobanSound.playCapture();
        }
        aiThinking = false;
        afterMove();
      }, 380);
    }

    afterMove();
  }

  // ---------- 视图切换 ----------
  function showView(name) {
    ['home', 'lesson', 'freeplay'].forEach(function (v) {
      document.getElementById('view-' + v).classList.toggle('active', v === name);
    });
    closeSidebar();
  }
  function showLesson(index) {
    renderLesson(index);
    showView('lesson');
  }

  // ---------- 侧栏目录 ----------
  function renderOutline() {
    var nav = document.getElementById('outline');
    clear(nav);
    window.COURSE.forEach(function (lesson, i) {
      var item = h('a', 'outline-item', (i + 1) + '. ' + lesson.title);
      item.href = '#lesson';
      if (isLessonDone(lesson.id)) item.classList.add('done');
      item.addEventListener('click', function (e) {
        e.preventDefault();
        showLesson(i);
      });
      nav.appendChild(item);
    });
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('backdrop').classList.add('show');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('show');
  }

  // ---------- 初始化 ----------
  function init() {
    document.getElementById('menuBtn').addEventListener('click', openSidebar);
    document.getElementById('backdrop').addEventListener('click', closeSidebar);

    // 声音开关
    var soundBtn = document.getElementById('soundBtn');
    GobanSound.setEnabled(progress.sound !== false);
    function updateSoundBtn() {
      var on = GobanSound.isEnabled();
      soundBtn.textContent = on ? '音效开' : '音效关';
      soundBtn.classList.toggle('muted', !on);
    }
    updateSoundBtn();
    soundBtn.addEventListener('click', function () {
      var next = !GobanSound.isEnabled();
      GobanSound.setEnabled(next);
      progress.sound = next;
      saveProgress();
      if (next) GobanSound.ensureCtx();
      updateSoundBtn();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var v = a.getAttribute('data-view');
        if (v === 'home') showView('home');
        else if (v === 'freeplay') { renderFreeplay(); showView('freeplay'); }
      });
    });

    renderOutline();
    renderHome();
    showView('home');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
