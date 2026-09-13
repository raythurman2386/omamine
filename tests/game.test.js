const G = require("../Game.js")

function seq() {
  var i = 1
  return function () {
    i = (i * 1103515245 + 12345) >>> 0
    return (i % 233280) / 233280
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed")
}

function count(state, pred) {
  var n = 0
  for (var i = 0; i < state.cells.length; i++) if (pred(state.cells[i])) n++
  return n
}

var beginner = G.newGame("beginner")
assert(beginner.width === 9 && beginner.height === 9 && beginner.cells.length === 81, "beginner size")
assert(beginner.mines === 10 && beginner.placed === false, "beginner spec")

var expert = G.newGame("expert")
assert(expert.width === 30 && expert.height === 16 && expert.cells.length === 480, "expert size")
assert(expert.mines === 99, "expert mines")

assert(G.normalizedDifficulty("nope") === "beginner", "unknown difficulty")
assert(G.pad3(99) === "099", "pad3 mines")
assert(G.pad3(-2) === "-02", "pad3 overflag")
assert(G.formatTime(65) === "1:05", "formatTime")

var s = G.reveal(G.newGame("beginner"), 4, 4, seq())
assert(s.placed, "mines placed on first reveal")
assert(!G.cellAt(s, 4, 4).mine, "first click is never a mine")
assert(G.cellAt(s, 4, 4).revealed, "first click reveals")
assert(count(s, function (c) { return c.mine }) === 10, "mine count after place")

var ring = G.neighbors(s, 4, 4)
for (var i = 0; i < ring.length; i++)
  assert(!ring[i].mine, "first-click neighborhood is safe")

s = G.flag(s, 0, 0)
assert(s.flags === 1 && G.cellAt(s, 0, 0).flagged, "flag")
assert(G.remaining(s) === 9, "remaining after flag")
s = G.flag(s, 0, 0)
assert(s.flags === 0 && !G.cellAt(s, 0, 0).flagged, "unflag")

s = G.flag(s, 0, 0)
var flagged = G.reveal(s, 0, 0, seq())
assert(G.cellAt(flagged, 0, 0).flagged && !G.cellAt(flagged, 0, 0).revealed, "flagged cell does not reveal")

var lose = G.newGame("beginner")
G.placeMines(lose, 0, 0, seq())
var mine = null
for (var m = 0; m < lose.cells.length; m++) if (lose.cells[m].mine) { mine = lose.cells[m]; break }
G.reveal(lose, mine.x, mine.y)
assert(lose.over && !lose.won && mine.exploded, "hitting a mine loses")
assert(count(lose, function (c) { return c.mine && c.revealed }) === lose.mines, "all mines shown on loss")

var win = G.newGame("beginner")
G.reveal(win, 2, 2, seq())
for (var w = 0; w < win.cells.length; w++) {
  var cell = win.cells[w]
  if (!cell.mine && !cell.revealed) G.reveal(win, cell.x, cell.y)
}
assert(win.won && win.over, "clearing safe cells wins")
assert(win.flags === win.mines, "win flags remaining mines")

var chord = G.newGame("beginner")
G.placeMines(chord, 0, 0, seq())
var numbered = null
for (var n = 0; n < chord.cells.length; n++) {
  if (!chord.cells[n].mine && chord.cells[n].adj === 1) { numbered = chord.cells[n]; break }
}
assert(numbered, "found a 1 for chord")
G.reveal(chord, numbered.x, numbered.y)
var around = G.neighbors(chord, numbered.x, numbered.y)
var neighborMine = null
for (var a = 0; a < around.length; a++) if (around[a].mine) neighborMine = around[a]
G.flag(chord, neighborMine.x, neighborMine.y)
G.chord(chord, numbered.x, numbered.y)
assert(!chord.over || chord.won, "correct chord does not lose")

G.moveCursor(chord, 100, 100)
assert(chord.cursorX === chord.width - 1 && chord.cursorY === chord.height - 1, "cursor clamps")

var times = G.recordBestTimes({}, "beginner", 12)
assert(times.beginner === 12, "first best time")
assert(G.recordBestTimes(times, "beginner", 20).beginner === 12, "keeps faster time")
assert(G.recordBestTimes(times, "beginner", 7).beginner === 7, "replaces slower time")
assert(G.recordBestTimes({}, "beginner", 0).beginner === 1, "zero elapsed records as 1s")

var view = G.view(win)
assert(view !== win && view.cells === win.cells, "view is a new wrapper")

console.log("ok")
