import QtQuick
import qs.Commons
import qs.Ui
import "Game.js" as Game

Panel {
  id: root
  moduleName: "io.github.raythurman2386.omamine"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  property var game: Game.view(Game.newGame("beginner"))
  property int revision: 0
  property int elapsed: 0
  property int cursorX: 0
  property int cursorY: 0
  property bool ticking: false
  property bool showHelp: false
  property var bestTimes: ({})

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property int cols: game ? game.width : 9
  readonly property int rows: game ? game.height : 9
  readonly property int cellGap: cols >= 24 ? 1 : 2
  readonly property int preferredCellSize: cols >= 24 ? Style.space(16) : (cols >= 16 ? Style.space(22) : Style.space(28))
  readonly property int preferredInnerWidth: cols * preferredCellSize + Math.max(0, cols - 1) * cellGap
  readonly property int cellSize: {
    var inner = boardHost.width > 0 ? boardHost.width : preferredInnerWidth
    var gapX = Math.max(0, cols - 1) * cellGap
    var byW = Math.floor((inner - gapX) / Math.max(1, cols))
    var availH = panel.availableCardHeight
    var byH = availH > 0
      ? Math.floor((availH - Style.space(160) - Math.max(0, rows - 1) * cellGap) / Math.max(1, rows))
      : preferredCellSize
    return Math.max(12, Math.min(preferredCellSize, byW, byH))
  }
  readonly property int boardPixelWidth: cols * cellSize + Math.max(0, cols - 1) * cellGap
  readonly property int boardHeight: rows * cellSize + Math.max(0, rows - 1) * cellGap
  readonly property string difficulty: Game.normalizedDifficulty(setting("difficulty", "beginner"))
  readonly property var difficultyOptions: [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Inter." },
    { value: "expert", label: "Expert" }
  ]

  function open() {
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened) setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]
    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function publish(state) {
    root.elapsed = state.elapsed
    root.cursorX = state.cursorX
    root.cursorY = state.cursorY
    root.ticking = !!(state.placed && !state.over)
    root.game = Game.view(state)
    root.revision++
  }

  function setCursor(x, y) {
    if (!root.game) return
    if (x === root.cursorX && y === root.cursorY) return
    Game.moveCursor(root.game, x - root.game.cursorX, y - root.game.cursorY)
    root.cursorX = root.game.cursorX
    root.cursorY = root.game.cursorY
  }

  function syncFrom(state) {
    publish(state)
    if (state.won) {
      var nextBest = Game.recordBestTimes(root.bestTimes, state.difficulty, state.elapsed)
      var improved = nextBest[state.difficulty] !== Number(root.bestTimes[state.difficulty] || 0)
      root.bestTimes = nextBest
      if (improved) persistSettings({ bestTimes: nextBest, difficulty: state.difficulty })
    }
  }

  function startGame(id) {
    var nextId = Game.normalizedDifficulty(id || root.difficulty)
    var state = Game.newGame(nextId)
    publish(state)
    if (nextId !== root.difficulty) persistSettings({ difficulty: nextId, bestTimes: root.bestTimes })
  }

  function revealAt(x, y) {
    Game.reveal(root.game, x, y)
    Game.moveCursor(root.game, x - root.game.cursorX, y - root.game.cursorY)
    syncFrom(root.game)
  }

  function flagAt(x, y) {
    Game.flag(root.game, x, y)
    Game.moveCursor(root.game, x - root.game.cursorX, y - root.game.cursorY)
    syncFrom(root.game)
  }

  function chordAt(x, y) {
    Game.chord(root.game, x, y)
    Game.moveCursor(root.game, x - root.game.cursorX, y - root.game.cursorY)
    syncFrom(root.game)
  }

  function cellGlyph(cell) {
    if (!cell) return ""
    if (root.game.over && !root.game.won && cell.flagged && !cell.mine) return "✕"
    if (cell.flagged && !cell.revealed) return "⚑"
    if (!cell.revealed) return ""
    if (cell.mine) return "󰷚"
    return cell.adj > 0 ? String(cell.adj) : ""
  }

  function cellColor(cell) {
    if (!cell || !cell.revealed || cell.mine || cell.adj <= 0) return contentForeground
    if (cell.adj === 1) return Color.accent
    if (cell.adj === 2) return contentForeground
    if (cell.adj === 3) return Color.urgent
    if (cell.adj === 4) return Color.muted
    if (cell.adj === 5) return Color.urgent
    if (cell.adj === 6) return Color.accent
    if (cell.adj === 7) return contentForeground
    return Color.muted
  }

  function cellFill(cell) {
    if (!cell) return "transparent"
    if (cell.exploded) return Util.alpha(Color.urgent, 0.45)
    if (cell.revealed) return Util.alpha(contentForeground, 0.06)
    return Util.alpha(contentForeground, 0.14)
  }

  function faceGlyph() {
    if (root.game.won) return "☻"
    if (root.game.over) return "☹"
    return "☺"
  }

  function bestLabel() {
    var best = Number(root.bestTimes[root.game.difficulty] || 0)
    return best > 0 ? "best " + Game.formatTime(best) : "best —"
  }

  function cellAtIndex(index) {
    var _ = root.revision
    if (!root.game || !root.game.cells) return null
    return root.game.cells[index]
  }

  function cellX(index) {
    return index % root.cols
  }

  function cellY(index) {
    return Math.floor(index / root.cols)
  }

  function applyIncomingSettings() {
    var storedTimes = setting("bestTimes", {})
    root.bestTimes = storedTimes && typeof storedTimes === "object" ? storedTimes : {}
    var next = Game.normalizedDifficulty(setting("difficulty", "beginner"))
    if (root.game && !root.game.placed && root.game.difficulty !== next)
      startGame(next)
  }

  onSettingsChanged: applyIncomingSettings()
  Component.onCompleted: applyIncomingSettings()

  Timer {
    interval: 1000
    running: root.ticking
    repeat: true
    onTriggered: {
      Game.tick(root.game)
      root.elapsed = root.game.elapsed
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Math.max(Style.space(440), preferredInnerWidth + Style.spacing.popupPadding * 2 + Style.space(24)))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        root.setCursor(root.cursorX + dx, root.cursorY + dy)
      }
      onActivateRequested: root.revealAt(root.game.cursorX, root.game.cursorY)
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onDeleteRequested: root.flagAt(root.game.cursorX, root.game.cursorY)
      onTextKey: function(t) {
        if (t === "f" || t === "F") root.flagAt(root.game.cursorX, root.game.cursorY)
        else if (t === "c" || t === "C") root.chordAt(root.game.cursorX, root.game.cursorY)
        else if (t === "n" || t === "N") root.startGame(root.game.difficulty)
        else if (t === "1") root.startGame("beginner")
        else if (t === "2") root.startGame("intermediate")
        else if (t === "3") root.startGame("expert")
        else if (t === "?") root.showHelp = !root.showHelp
      }

      Flickable {
        id: boardScroll
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height + 8
        flickableDirection: Flickable.VerticalFlick

      Column {
        id: content
        width: boardScroll.width
        spacing: Style.space(10)

        Column {
          width: parent.width
          spacing: Style.space(8)

          ButtonGroup {
            id: difficultyRow
            anchors.horizontalCenter: parent.horizontalCenter
            options: root.difficultyOptions
            value: root.game.difficulty
            foreground: root.contentForeground
            background: Color.popups.background
            accent: Color.accent
            fontFamily: root.contentFontFamily
            fontSize: Style.font.caption
            focusable: false
            onChanged: function(value) { root.startGame(value) }
          }

          Row {
            id: statusRow
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Style.space(12)

            Text {
              text: Game.pad3(Game.remaining(root.game))
              textFormat: Text.PlainText
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.subtitle
              font.bold: true
              anchors.verticalCenter: parent.verticalCenter
            }

            Button {
              text: root.faceGlyph()
              tooltipText: "New game"
              foreground: root.contentForeground
              bordered: true
              fontFamily: root.contentFontFamily
              fontSize: Style.font.title
              onClicked: root.startGame(root.game.difficulty)
            }

            Text {
              text: Game.formatTime(root.elapsed)
              textFormat: Text.PlainText
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.subtitle
              font.bold: true
              anchors.verticalCenter: parent.verticalCenter
            }
          }
        }

        Item {
          id: boardHost
          width: parent.width
          height: root.boardHeight
          clip: true

          Repeater {
            model: root.cols * root.rows

            Rectangle {
              required property int index
              readonly property bool isCursor: index === root.cursorY * root.cols + root.cursorX

              x: Math.floor((boardHost.width - root.boardPixelWidth) / 2) + (index % root.cols) * (root.cellSize + root.cellGap)
              y: Math.floor(index / root.cols) * (root.cellSize + root.cellGap)
              width: root.cellSize
              height: root.cellSize
              radius: Math.min(Style.space(3), Math.floor(root.cellSize / 5))
              color: root.cellFill(root.cellAtIndex(index))
              border.width: isCursor ? 2 : 1
              border.color: isCursor
                ? Color.accent
                : Util.alpha(root.contentForeground, root.cellAtIndex(index) && root.cellAtIndex(index).revealed ? 0.08 : 0.22)

              Text {
                anchors.centerIn: parent
                text: root.cellGlyph(root.cellAtIndex(index))
                textFormat: Text.PlainText
                color: root.cellColor(root.cellAtIndex(index))
                font.family: root.contentFontFamily
                font.pixelSize: Math.max(8, Math.min(Style.font.caption, Math.round(root.cellSize * 0.58)))
                font.bold: true
              }

              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                preventStealing: true
                acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
                cursorShape: Qt.PointingHandCursor
                onEntered: root.setCursor(root.cellX(index), root.cellY(index))
                onPressed: function(mouse) {
                  var x = root.cellX(index)
                  var y = root.cellY(index)
                  mouse.accepted = true
                  if (mouse.button === Qt.RightButton) root.flagAt(x, y)
                  else if (mouse.button === Qt.MiddleButton) root.chordAt(x, y)
                  else root.revealAt(x, y)
                }
              }
            }
          }
        }

        Text {
          width: parent.width
          text: root.showHelp
            ? "space/click open · f/right-click flag · c/middle chord · n new · 1–3 difficulty · esc close"
            : root.bestLabel() + "  ·  ? keys"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          wrapMode: Text.WordWrap
        }
      }
      }
    }
  }
}
