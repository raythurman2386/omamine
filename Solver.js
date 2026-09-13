function keyOf(x, y) {
  return x + "," + y
}

function parseKey(key) {
  var parts = String(key).split(",")
  return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) }
}

function cellListHas(cells, key) {
  for (var i = 0; i < cells.length; i++) if (cells[i] === key) return true
  return false
}

function cellListEqual(a, b) {
  if (a.length !== b.length) return false
  for (var i = 0; i < a.length; i++) if (!cellListHas(b, a[i])) return false
  return true
}

function cellListWithout(cells, key) {
  var out = []
  for (var i = 0; i < cells.length; i++) if (cells[i] !== key) out.push(cells[i])
  return out
}

function cellListDiff(left, right) {
  var out = []
  for (var i = 0; i < left.length; i++) if (!cellListHas(right, left[i])) out.push(left[i])
  return out
}

function isProperSubset(inner, outer) {
  if (inner.length === 0 || inner.length >= outer.length) return false
  for (var i = 0; i < inner.length; i++) if (!cellListHas(outer, inner[i])) return false
  return true
}

function sentenceEqual(a, b) {
  return a.count === b.count && cellListEqual(a.cells, b.cells)
}

function knowledgeHas(knowledge, sentence) {
  for (var i = 0; i < knowledge.length; i++) if (sentenceEqual(knowledge[i], sentence)) return true
  return false
}

function neighborKeys(state, x, y) {
  var out = []
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      var nx = x + dx
      var ny = y + dy
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue
      out.push(keyOf(nx, ny))
    }
  }
  return out
}

function cellByKey(state, key) {
  var p = parseKey(key)
  if (p.x < 0 || p.y < 0 || p.x >= state.width || p.y >= state.height) return null
  return state.cells[p.y * state.width + p.x]
}

function markMine(mines, safes, knowledge, key) {
  if (safes[key] || mines[key]) return false
  mines[key] = true
  var changed = false
  for (var i = 0; i < knowledge.length; i++) {
    var sentence = knowledge[i]
    if (!cellListHas(sentence.cells, key)) continue
    sentence.cells = cellListWithout(sentence.cells, key)
    sentence.count = Math.max(0, sentence.count - 1)
    changed = true
  }
  return changed
}

function markSafe(mines, safes, knowledge, key) {
  if (safes[key] || mines[key]) return false
  safes[key] = true
  var changed = false
  for (var i = 0; i < knowledge.length; i++) {
    var sentence = knowledge[i]
    if (!cellListHas(sentence.cells, key)) continue
    sentence.cells = cellListWithout(sentence.cells, key)
    changed = true
  }
  return changed
}

function addSentence(knowledge, cells, count) {
  if (!cells.length) return false
  var sentence = { cells: cells.slice(), count: Math.max(0, count) }
  if (knowledgeHas(knowledge, sentence)) return false
  knowledge.push(sentence)
  return true
}

function infer(state) {
  var mines = ({})
  var safes = ({})
  var knowledge = []
  var hidden = []
  var flagged = 0

  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    var key = keyOf(cell.x, cell.y)
    if (cell.revealed) {
      safes[key] = true
      continue
    }
    if (cell.flagged) {
      mines[key] = true
      flagged++
      continue
    }
    hidden.push(key)
  }

  for (var r = 0; r < state.cells.length; r++) {
    var src = state.cells[r]
    if (!src.revealed || src.mine) continue
    var undetermined = []
    var count = src.adj
    var around = neighborKeys(state, src.x, src.y)
    for (var n = 0; n < around.length; n++) {
      var neighbor = cellByKey(state, around[n])
      if (!neighbor) continue
      if (neighbor.flagged || mines[around[n]]) count--
      else if (!neighbor.revealed && !safes[around[n]]) undetermined.push(around[n])
    }
    addSentence(knowledge, undetermined, count)
  }

  var remain = state.mines - flagged
  if (remain === 0) {
    for (var s = 0; s < hidden.length; s++) safes[hidden[s]] = true
  } else if (remain > 0 && remain === hidden.length) {
    for (var m = 0; m < hidden.length; m++) mines[hidden[m]] = true
  }

  var guard = 0
  while (guard++ < 400) {
    var changed = false

    remain = state.mines - 0
    var knownMineCount = 0
    var stillHidden = []
    for (var h = 0; h < hidden.length; h++) {
      if (mines[hidden[h]]) knownMineCount++
      else if (!safes[hidden[h]]) stillHidden.push(hidden[h])
    }
    remain = state.mines - flagged
    var inferredMines = 0
    for (var im in mines) if (mines[im] && !cellByKey(state, im).flagged) inferredMines++
    var unknownRemain = remain - inferredMines
    if (unknownRemain < 0) unknownRemain = 0
    if (unknownRemain === 0 && stillHidden.length) {
      for (var z = 0; z < stillHidden.length; z++) {
        if (markSafe(mines, safes, knowledge, stillHidden[z])) changed = true
        else safes[stillHidden[z]] = true
      }
    } else if (unknownRemain > 0 && unknownRemain === stillHidden.length) {
      for (var k = 0; k < stillHidden.length; k++) {
        if (markMine(mines, safes, knowledge, stillHidden[k])) changed = true
        else mines[stillHidden[k]] = true
      }
    }

    for (var si = 0; si < knowledge.length; si++) {
      var sentence = knowledge[si]
      if (!sentence.cells.length) continue
      if (sentence.cells.length === sentence.count && sentence.count > 0) {
        var mineKeys = sentence.cells.slice()
        for (var mk = 0; mk < mineKeys.length; mk++)
          if (markMine(mines, safes, knowledge, mineKeys[mk])) changed = true
      } else if (sentence.count === 0) {
        var safeKeys = sentence.cells.slice()
        for (var sk = 0; sk < safeKeys.length; sk++)
          if (markSafe(mines, safes, knowledge, safeKeys[sk])) changed = true
      }
    }

    var derived = []
    for (var a = 0; a < knowledge.length; a++) {
      for (var b = 0; b < knowledge.length; b++) {
        if (a === b) continue
        var s1 = knowledge[a]
        var s2 = knowledge[b]
        if (!isProperSubset(s1.cells, s2.cells)) continue
        var derivedCells = cellListDiff(s2.cells, s1.cells)
        var derivedCount = s2.count - s1.count
        if (derivedCells.length && derivedCount >= 0)
          derived.push({ cells: derivedCells, count: derivedCount })
      }
    }
    for (var d = 0; d < derived.length; d++)
      if (addSentence(knowledge, derived[d].cells, derived[d].count)) changed = true

    if (!changed) break
  }

  return { mines: mines, safes: safes }
}

function hint(state) {
  if (!state || state.over) return { type: "none" }
  if (!state.placed) {
    return {
      type: "reveal",
      x: Math.floor(state.width / 2),
      y: Math.floor(state.height / 2)
    }
  }

  var kb = infer(state)
  var i
  for (i = 0; i < state.cells.length; i++) {
    var safeCell = state.cells[i]
    var safeKey = keyOf(safeCell.x, safeCell.y)
    if (!safeCell.revealed && !safeCell.flagged && kb.safes[safeKey])
      return { type: "reveal", x: safeCell.x, y: safeCell.y }
  }
  for (i = 0; i < state.cells.length; i++) {
    var mineCell = state.cells[i]
    var mineKey = keyOf(mineCell.x, mineCell.y)
    if (!mineCell.revealed && !mineCell.flagged && kb.mines[mineKey])
      return { type: "flag", x: mineCell.x, y: mineCell.y }
  }
  return { type: "none" }
}

if (typeof module !== "undefined") {
  module.exports = {
    infer: infer,
    hint: hint
  }
}
