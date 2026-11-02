// 内容校验：坐标合法性 + 练习题答案可落子（node content.test.js）
'use strict';
global.window = {};
var Goban = require('./goban.js');
require('./content.js');
var COURSE = global.window.COURSE;

var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ok  ' + msg); }
  else { failed++; console.log('FAIL  ' + msg); }
}
function checkCoords(list, size, label) {
  var bad = [];
  (list || []).forEach(function (s) {
    if (!Goban.parseCoord(s, size)) bad.push(s);
  });
  assert(bad.length === 0, label + (bad.length ? ' 非法坐标: ' + bad.join(',') : ' 坐标合法'));
  return bad.length === 0;
}

console.log('共 ' + COURSE.length + ' 课');

COURSE.forEach(function (lesson, li) {
  console.log('== ' + (li + 1) + '. ' + lesson.title + ' ==');
  assert(lesson.sections && lesson.sections.length > 0, '有内容');
  lesson.sections.forEach(function (s, si) {
    var size = s.size || 9;
    var tag = '  §' + (si + 1) + ' [' + s.type + ']';
    if (s.black || s.white) {
      checkCoords(s.black, size, tag + ' 黑');
      checkCoords(s.white, size, tag + ' 白');
    }
    if (s.marks) checkCoords(s.marks, size, tag + ' 标记');

    if (s.type === 'exercise') {
      checkCoords(s.answer, size, tag + ' 答案');
      // 模拟：摆好局面，落答案子，应合法
      var g = new Goban(size);
      g.setup(s.black, s.white);
      g.turn = s.color || Goban.BLACK;
      var p = Goban.parseCoord(s.answer[0], size);
      var res = g.play(p.x, p.y);
      assert(res.ok, tag + ' 答案 ' + s.answer[0] + ' 可落子' + (res.ok ? '' : '（' + res.error + '）'));
    }
  });
});

console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed ? 1 : 0);
