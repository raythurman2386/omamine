function difficulties() {
  return {
    beginner: { id: "beginner", label: "Beginner", width: 9, height: 9, mines: 10 },
    intermediate: { id: "intermediate", label: "Inter.", width: 16, height: 16, mines: 40 },
    expert: { id: "expert", label: "Expert", width: 30, height: 16, mines: 99 }
  }
}

function difficultyIds() {
  return ["beginner", "intermediate", "expert"]
}

function normalizedDifficulty(id) {
  var table = difficulties()
  var key = String(id || "beginner")
  return table[key] ? key : "beginner"
}

function specFor(id) {
  return difficulties()[normalizedDifficulty(id)]
}

function indexOf(state, x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return -1
  return y * state.width + x
}

function cellAt(state, x, y) {
  var i = indexOf(state, x, y)
  return i < 0 ? null : state.cells[i]
}

function remaining(state) {
  return state.mines - state.flags
}

function view(state) {
  if (!state) return state
  return {
    difficulty: state.difficulty,
    width: state.width,
    height: state.height,
    mines: state.mines,
    cells: state.cells,
    placed: state.placed,
    over: state.over,
    won: state.won,
    flags: state.flags,
    revealedCount: state.revealedCount,
    cursorX: state.cursorX,
    cursorY: state.cursorY,
    elapsed: state.elapsed
  }
}

function pad3(n) {
  var v = Math.floor(Number(n) || 0)
  if (v < 0) {
    var mag = String(Math.min(99, -v))
    while (mag.length < 2) mag = "0" + mag
    return "-" + mag
  }
  var s = String(Math.max(0, v))
  while (s.length < 3) s = "0" + s
  return s
}

function formatTime(seconds) {
  var n = Math.max(0, Math.floor(Number(seconds) || 0))
  var m = Math.floor(n / 60)
  var s = n % 60
  return m + ":" + (s < 10 ? "0" : "") + s
}

function newGame(difficulty) {
  var spec = specFor(difficulty)
  var cells = []
  for (var y = 0; y < spec.height; y++) {
    for (var x = 0; x < spec.width; x++) {
      cells.push({
        x: x,
        y: y,
        mine: false,
        adj: 0,
        revealed: false,
        flagged: false,
        exploded: false
      })
    }
  }
  return {
    difficulty: spec.id,
    width: spec.width,
    height: spec.height,
    mines: spec.mines,
    cells: cells,
    placed: false,
    over: false,
    won: false,
    flags: 0,
    revealedCount: 0,
    cursorX: 0,
    cursorY: 0,
    elapsed: 0
  }
}

function moveCursor(state, dx, dy) {
  if (!state) return state
  var x = state.cursorX + dx
  var y = state.cursorY + dy
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x >= state.width) x = state.width - 1
  if (y >= state.height) y = state.height - 1
  state.cursorX = x
  state.cursorY = y
  return state
}

function neighbors(state, x, y) {
  var out = []
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      var cell = cellAt(state, x + dx, y + dy)
      if (cell) out.push(cell)
    }
  }
  return out
}

function shuffle(values, random) {
  var rand = random || Math.random
  for (var i = values.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1))
    var tmp = values[i]
    values[i] = values[j]
    values[j] = tmp
  }
  return values
}

function placeMines(state, safeX, safeY, random) {
  var forbidden = {}
  var ring = neighbors(state, safeX, safeY)
  forbidden[safeX + "," + safeY] = true
  for (var r = 0; r < ring.length; r++) forbidden[ring[r].x + "," + ring[r].y] = true

  var candidates = []
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!forbidden[cell.x + "," + cell.y]) candidates.push(cell)
  }

  if (candidates.length < state.mines) {
    candidates = []
    for (var j = 0; j < state.cells.length; j++) {
      var next = state.cells[j]
      if (!(next.x === safeX && next.y === safeY)) candidates.push(next)
    }
  }

  shuffle(candidates, random)
  var count = Math.min(state.mines, candidates.length)
  for (var m = 0; m < count; m++) candidates[m].mine = true
  state.mines = count

  for (var k = 0; k < state.cells.length; k++) {
    var target = state.cells[k]
    if (target.mine) {
      target.adj = 0
      continue
    }
    var adj = 0
    var around = neighbors(state, target.x, target.y)
    for (var n = 0; n < around.length; n++) if (around[n].mine) adj++
    target.adj = adj
  }

  state.placed = true
  return state
}

function revealCell(state, cell) {
  if (!cell || cell.revealed || cell.flagged || state.over) return
  cell.revealed = true
  state.revealedCount++
  if (cell.mine) {
    cell.exploded = true
    explode(state)
    return
  }
  if (cell.adj === 0) flood(state, cell)
}

function flood(state, start) {
  var queue = [start]
  while (queue.length) {
    var cell = queue.shift()
    var around = neighbors(state, cell.x, cell.y)
    for (var i = 0; i < around.length; i++) {
      var next = around[i]
      if (next.revealed || next.flagged || next.mine) continue
      next.revealed = true
      state.revealedCount++
      if (next.adj === 0) queue.push(next)
    }
  }
}

function explode(state) {
  state.over = true
  state.won = false
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (cell.mine) cell.revealed = true
  }
}

function checkWin(state) {
  if (state.over) return state
  var safe = state.width * state.height - state.mines
  if (state.revealedCount < safe) return state
  state.over = true
  state.won = true
  state.flags = state.mines
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (cell.mine) cell.flagged = true
  }
  return state
}

function reveal(state, x, y, random) {
  if (!state || state.over) return state
  var cell = cellAt(state, x, y)
  if (!cell || cell.revealed || cell.flagged) return state
  if (!state.placed) placeMines(state, x, y, random)
  revealCell(state, cell)
  return checkWin(state)
}

function flag(state, x, y) {
  if (!state || state.over) return state
  var cell = cellAt(state, x, y)
  if (!cell || cell.revealed) return state
  cell.flagged = !cell.flagged
  state.flags += cell.flagged ? 1 : -1
  return state
}

function chord(state, x, y, random) {
  if (!state || state.over) return state
  var cell = cellAt(state, x, y)
  if (!cell) return state
  if (!cell.revealed) return reveal(state, x, y, random)
  if (cell.adj <= 0) return state
  var around = neighbors(state, x, y)
  var flagged = 0
  for (var i = 0; i < around.length; i++) if (around[i].flagged) flagged++
  if (flagged !== cell.adj) return state
  for (var j = 0; j < around.length; j++) {
    var next = around[j]
    if (!next.flagged && !next.revealed) reveal(state, next.x, next.y, random)
    if (state.over && !state.won) return state
  }
  return checkWin(state)
}

function tick(state) {
  if (!state || state.over || !state.placed) return state
  state.elapsed += 1
  return state
}

function recordBestTimes(bestTimes, difficulty, elapsed) {
  var times = bestTimes && typeof bestTimes === "object" ? bestTimes : {}
  var key = normalizedDifficulty(difficulty)
  var next = {}
  var ids = difficultyIds()
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]
    var value = Number(times[id])
    next[id] = isFinite(value) && value > 0 ? Math.floor(value) : 0
  }
  var seconds = Math.max(1, Math.floor(Number(elapsed) || 0))
  if (!next[key] || seconds < next[key]) next[key] = seconds
  return next
}

if (typeof module !== "undefined") {
  module.exports = {
    difficulties: difficulties,
    difficultyIds: difficultyIds,
    normalizedDifficulty: normalizedDifficulty,
    specFor: specFor,
    indexOf: indexOf,
    cellAt: cellAt,
    remaining: remaining,
    view: view,
    pad3: pad3,
    formatTime: formatTime,
    newGame: newGame,
    moveCursor: moveCursor,
    neighbors: neighbors,
    placeMines: placeMines,
    reveal: reveal,
    flag: flag,
    chord: chord,
    tick: tick,
    recordBestTimes: recordBestTimes
  }
}
