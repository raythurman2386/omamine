const G = require("../Game.js")
const S = require("../Solver.js")

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed")
}

function makeState(width, height, mineList, revealedList, flaggedList) {
  var cells = []
  var mines = {}
  var i
  for (i = 0; i < mineList.length; i++) mines[mineList[i][0] + "," + mineList[i][1]] = true
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      cells.push({
        x: x,
        y: y,
        mine: !!mines[x + "," + y],
        adj: 0,
        revealed: false,
        flagged: false,
        exploded: false
      })
    }
  }
  function at(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return null
    return cells[y * width + x]
  }
  for (i = 0; i < cells.length; i++) {
    if (cells[i].mine) continue
    var adj = 0
    for (var dy = -1; dy <= 1; dy++)
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        var n = at(cells[i].x + dx, cells[i].y + dy)
        if (n && n.mine) adj++
      }
    cells[i].adj = adj
  }
  var flags = 0
  for (i = 0; i < revealedList.length; i++) at(revealedList[i][0], revealedList[i][1]).revealed = true
  for (i = 0; flaggedList && i < flaggedList.length; i++) {
    at(flaggedList[i][0], flaggedList[i][1]).flagged = true
    flags++
  }
  var revealedCount = 0
  for (i = 0; i < cells.length; i++) if (cells[i].revealed) revealedCount++
  return {
    difficulty: "beginner",
    width: width,
    height: height,
    mines: mineList.length,
    cells: cells,
    placed: true,
    over: false,
    won: false,
    flags: flags,
    revealedCount: revealedCount,
    cursorX: 0,
    cursorY: 0,
    elapsed: 0
  }
}

assert(S.hint({ over: true, placed: true, cells: [] }).type === "none", "over is none")

var first = S.hint(G.newGame("beginner"))
assert(first.type === "reveal" && first.x === 4 && first.y === 4, "unstarted hint is center")

var allOpen = makeState(3, 3, [[0, 0]], [
  [1, 0], [2, 0],
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2]
])
var flagHint = S.hint(allOpen)
assert(flagHint.type === "flag" && flagHint.x === 0 && flagHint.y === 0, "last hidden cell is the mine")

var leftoverSafe = makeState(3, 3, [[0, 0]], [
  [2, 0],
  [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2]
], [[0, 0]])
var safeHint = S.hint(leftoverSafe)
assert(safeHint.type === "reveal", "remaining mines 0 so hidden cells are safe")
assert(!G.cellAt(leftoverSafe, safeHint.x, safeHint.y).mine, "hint does not open a mine")
assert(!G.cellAt(leftoverSafe, safeHint.x, safeHint.y).revealed, "hint opens a hidden cell")

var numbered = makeState(2, 2, [[0, 0]], [[1, 1]])
var numberedHint = S.hint(numbered)
assert(numberedHint.type === "none" || numberedHint.type === "reveal" || numberedHint.type === "flag", "returns a move kind")

var seq = (function () {
  var i = 7
  return function () {
    i = (i * 1103515245 + 12345) >>> 0
    return (i % 233280) / 233280
  }
})()
var play = G.reveal(G.newGame("beginner"), 4, 4, seq)
var steps = 0
var guesses = 0
while (!play.over && steps < 200) {
  var move = S.hint(play)
  if (move.type === "none") {
    guesses++
    break
  }
  if (move.type === "reveal") G.reveal(play, move.x, move.y)
  else G.flag(play, move.x, move.y)
  steps++
}
assert(guesses === 1 || play.won || play.over, "solver either wins, loses only via player board, or stops when stuck")
assert(!(play.over && !play.won && guesses === 0), "certain hints must not hit a mine")
console.log("self-solve steps", steps, "won", play.won, "stuck", guesses === 1, "over", play.over)

console.log("ok")
