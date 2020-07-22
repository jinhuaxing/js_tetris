"use strict";

var BOARD_WIDTH = 10;
var BOARD_HEIGHT = 20;
var CONTROL_WIDTH = 3;

var COLORS = [
  "rgb(226, 50, 88)",
  "rgb(203, 192, 130)",
  "rgb(103, 145, 123)",
  "rgb(183, 175, 2)"
];

var COLOR_INACTIVE = "rgba(100, 100, 100, 1.0)";

var SHAPES = [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
];

var INTERVAL = 500;

var canvas = document.getElementById("canvas");
var previewCanvas = document.getElementById("preview");
var scorePane = document.getElementById("scorePane");
var maxScoreText = document.getElementById("maxScore");
var scoreText = document.getElementById("score");
var ctx = canvas.getContext("2d");
var previewCtx = previewCanvas.getContext("2d");
var pauseButton = document.getElementById("pauseButton");
var restartButton = document.getElementById("restartButton");

var shapeObjects = createShapeObjects();

var map;
var currentShape;
var currentShapeInfo;
var previewShape;
var previewShapeInfo;
var currentX;
var currentY;
var currentColor;
var previewColor;
var stopped;
var paused;
var timer;
var score;
var layout;
var gameOver;

window.onload = main;

function main() {
  initCanvas();
  disableTouchOnDocument();
  setupHammerTouch();
  setupControl();
  restart();
}

function initCanvas() {
  resizeCanvas();
  drawGrid();
  window.addEventListener("resize", function() {
    resizeCanvas();
    drawGrid();
    drawGame();
  });
}

function disableTouchOnDocument() {
  document.addEventListener(
    "touchstart",
    function(event) {
      if (
        event.touches[0].target === restartButton ||
        event.touches[0].target === pauseButton
      ) {
        //Continue the event delivery, to control the buttons
      } else {
        event.stopPropagation();
      }
    },
    false
  );
}

function setupHammerTouch() {
  if (typeof Hammer === "undefined") {
    console.log("hammer.js is unavailable.");
    return;
  }
  var container = document.getElementById("container");
  var hammer = new Hammer(document, {
    swipe_velocity: 0.1,
    doubletap_interval: 200
  });

  function pauseCheck(event, f) {
    if (stopped || paused) return;
    event.stopPropagation();
    f();
  }

  hammer.on("swipeleft", function onSwipeLeft(event) {
    pauseCheck(event, goLeft);
  });
  hammer.on("swiperight", function onSwipeRight(event) {
    pauseCheck(event, goRight);
  });
  hammer.on("swipeup", function onSwipeUp(event) {
    pauseCheck(event, goRotate);
  });
  hammer.on("swipedown", function onSwipeDown(event) {
    pauseCheck(event, goDown);
  });
  hammer.on("doubletap", function onDoubleTap(event) {
    pauseCheck(event, goDownDirectly);
  });
}

function setupControl() {
  window.onkeydown = function(e) {
    if (stopped || paused) return;

    switch (e.keyCode) {
      case 37:
        e.preventDefault();
        goLeft();
        break;
      case 39:
        e.preventDefault();
        goRight();
        break;
      case 38:
        e.preventDefault();
        goRotate();
        break;
      case 40:
        e.preventDefault();
        goDown();
        break;
    }
  };

  pauseButton.onclick = function() {
    pauseButton.blur();
    if (stopped) {
      return;
    }
    paused = !paused;
    updateButtonText();
    if (paused) {
      stopTimer();
    } else {
      startTimer();
    }
  };

  restartButton.onclick = function() {
    restartButton.blur();
    restart();
  };
}

function pause() {
  if (stopped) {
    return;
  }
  paused = true;
  updateButtonText();
  stopTimer();
}

function resizeCanvas() {
  layout = calculateLayoutParameters(
    document.width || document.body.clientWidth,
    document.height || document.body.clientHeight
  );
  setupScreen();
}

function calculateLayoutParameters(canvasWidth, canvasHeight) {
  var ratio = BOARD_HEIGHT / (BOARD_WIDTH + CONTROL_WIDTH);
  var gameWidth = 0;
  var gameHeight = 0;
  var startX = 0;
  var startY = 0;
  var blockSize = 0;

  if (canvasHeight / canvasWidth > ratio) {
    gameWidth = canvasWidth;
    gameHeight = gameWidth * ratio;
    startX = 0;
    startY = (canvasHeight - gameHeight) / 2;
  } else {
    gameHeight = canvasHeight;
    gameWidth = gameHeight * (1 / ratio);
    startX = (canvasWidth - gameWidth) / 2;
    startY = 0;
  }
  blockSize = Math.floor(gameHeight / BOARD_HEIGHT);

  return {
    startX: startX,
    startY: startY,
    blockSize: blockSize,
    controlStartX: startX + BOARD_WIDTH * blockSize,
    controlStartY: startY,
    previewBlockSize: Math.floor(blockSize * 0.7)
  };
}

function setupScreen() {
  var blockSize = layout.blockSize;
  canvas.width = blockSize * BOARD_WIDTH;
  canvas.height = blockSize * BOARD_HEIGHT;
  canvas.style.left = layout.startX + "px";
  canvas.style.top = layout.startY + "px";

  var controlPane = document.getElementById("control");
  controlPane.style.left = layout.controlStartX + "px";
  controlPane.style.top = layout.controlStartY + "px";
  controlPane.style.height = blockSize * BOARD_HEIGHT + "px";
  controlPane.style.width = blockSize * CONTROL_WIDTH + "px";

  var restartButton = document.getElementById("restartButton");
  restartButton.style.left = "0px";
  restartButton.style.top = 1 * blockSize + "px";
  restartButton.style.width = blockSize * CONTROL_WIDTH + "px";
  restartButton.style.height = blockSize * 2 + "px";
  restartButton.style.display = "block";

  var pauseButton = document.getElementById("pauseButton");
  pauseButton.style.left = "0px";
  pauseButton.style.top = 4 * blockSize + "px";
  pauseButton.style.width = blockSize * CONTROL_WIDTH + "px";
  pauseButton.style.height = blockSize * 2 + "px";
  pauseButton.style.display = "block";

  previewCanvas.width = layout.previewBlockSize * 4;
  previewCanvas.height = layout.previewBlockSize * 4;
  previewCanvas.style.left = Math.floor(0.3 * blockSize) + "px";
  previewCanvas.style.top = 7 * blockSize + "px";

  var scorePane = document.getElementById("scorePane");
  scorePane.style.left = "0px";
  scorePane.style.top = 14 * blockSize + "px";
  scorePane.style.width = blockSize * CONTROL_WIDTH + "px";
  scorePane.style.display = "block";

  if (window.localStorage) {
    var maxScorePane = document.getElementById("maxScorePane");
    maxScorePane.style.left = "0px";
    maxScorePane.style.top = 18 * blockSize + "px";
    maxScorePane.style.width = blockSize * CONTROL_WIDTH + "px";
    maxScorePane.style.display = "block";
  }

  var gameOverPane = document.getElementById("gameOverPane");
  gameOverPane.style.left = layout.startX + blockSize * 2 + "px";
  gameOverPane.style.top = layout.startY + blockSize * 4 + "px";
  gameOverPane.style.width = blockSize * 6 + "px";
}

//Main entry to update all the elements of the game.
//It is called by the game model when it wants update the GUI.
function drawGame() {
  drawBoard(map, layout.blockSize);
  drawShape(currentShape.shape, currentX, currentY);
  drawPreview(
    previewShape.shape,
    getCenter(4, previewShape.width),
    getCenter(4, previewShape.height),
    layout.previewBlockSize
  );
  scoreText.innerHTML = score;
  maxScoreText.innerHTML = updateMaxScore(score);
  showGameOverIfNeeded();
}

//Blink the rows.
//It gets called when the game model is about to remove
//the full rows.
function clearRows(rows) {
  var blinkOn = true;
  function draw() {
    rows.forEach(function(row) {
      map[row].forEach(function(colorIndex, j) {
        if (blinkOn) {
          clearBlock(
            ctx,
            j * layout.blockSize,
            row * layout.blockSize,
            layout.blockSize
          );
        } else {
          if (colorIndex > 0) {
            ctx.fillStyle = COLORS[colorIndex - 1];
            drawBlock(
              ctx,
              j * layout.blockSize,
              row * layout.blockSize,
              layout.blockSize,
              layout.blockSize
            );
          }
        }
      });
    });
  }
  for (var k = 0; k < 4; k++) {
    setTimeout(function() {
      draw();
      blinkOn = !blinkOn;
    }, 100 * k);
  }
}

function drawGrid() {
  for (var i = 1; i < BOARD_HEIGHT; i++) {
    ctx.moveTo(0, i * layout.blockSize);
    ctx.lineTo(layout.blockSize * BOARD_WIDTH, i * layout.blockSize);
  }

  for (var i = 1; i < BOARD_WIDTH; i++) {
    ctx.moveTo(i * layout.blockSize, 0);
    ctx.lineTo(i * layout.blockSize, layout.blockSize * BOARD_HEIGHT);
  }
  ctx.strokeStyle = "rgb(80, 80, 80)";
  ctx.stroke();
}

function drawBoard(map, size) {
  //ctx.clearRect(0, 0, layout.blockSize * BOARD_WIDTH, layout.blockSize * BOARD_HEIGHT);
  //drawGrid();
  map.forEach(function(row, i) {
    row.forEach(function(colorIndex, j) {
      if (colorIndex > 0) {
        ctx.fillStyle = gameOver ? COLOR_INACTIVE : COLORS[colorIndex - 1];
        drawBlock(ctx, j * size, i * size, size);
      } else {
        clearBlock(ctx, j * size, i * size, size);
      }
    });
  });
}

function drawShape(shape, x, y) {
  shape.forEach(function(point) {
    if (y + point.y >= 0) {
      // y might be negative which indicates the
      // block is out of the map
      ctx.fillStyle = gameOver ? COLOR_INACTIVE : COLORS[currentColor - 1];
      drawBlock(
        ctx,
        (x + point.x) * layout.blockSize,
        (y + point.y) * layout.blockSize,
        layout.blockSize
      );
    }
  });
}

function clearShape(shape, x, y) {
  shape.forEach(function(point) {
    clearBlock(
      ctx,
      (x + point.x) * layout.blockSize,
      (y + point.y) * layout.blockSize,
      layout.blockSize
    );
  });
}

function drawPreview(shape, x, y, size) {
  previewCtx.clearRect(0, 0, 4 * size, 4 * size);
  previewCtx.fillStyle = COLORS[previewColor - 1];
  shape.forEach(function(point) {
    drawBlock(previewCtx, (x + point.x) * size, (y + point.y) * size, size);
  });
}

function showGameOverIfNeeded() {
  var gameOverPane = document.getElementById("gameOverPane");
  if (gameOver) {
    setTimeout(function() {
      gameOverPane.style.display = "block";
    }, 150);
  } else {
    gameOverPane.style.display = "none";
  }
}

function drawBlock(context, x, y, size) {
  context.fillRect(x + 1, y + 1, size - 2, size - 2);
}

function clearBlock(context, x, y, size) {
  context.clearRect(x + 1, y + 1, size - 2, size - 2);
}

function updateButtonText() {
  if (paused) {
    pauseButton.value = "继续";
  } else {
    pauseButton.value = "暂停";
  }
}

function updateMaxScore(score) {
  if (isNaN(updateMaxScore.maxScore)) {
    updateMaxScore.maxScore = 0;
    if (window.localStorage) {
      updateMaxScore.maxScore = parseInt(window.localStorage["maxScore"]);
      if (isNaN(updateMaxScore.maxScore)) {
        updateMaxScore.maxScore = 0;
      }
    }
  }
  if (score > updateMaxScore.maxScore) {
    updateMaxScore.maxScore = score;
    if (window.localStorage) {
      window.localStorage["maxScore"] = score;
    }
  }
  return updateMaxScore.maxScore;
}

//Game model starts here.

function reset() {
  stopTimer();
  map = createMap(BOARD_WIDTH, BOARD_HEIGHT);
  if (previewShape != null) {
    currentShapeInfo = previewShapeInfo;
    currentShape = previewShape;
    currentColor = previewColor;
  } else {
    currentShapeInfo = generateShapeInfo();
    currentShape =
      shapeObjects[currentShapeInfo.shapeType][currentShapeInfo.direction];
    currentColor = parseInt(Math.random() * COLORS.length) + 1;
  }
  previewShapeInfo = generateShapeInfo();
  previewShape =
    shapeObjects[previewShapeInfo.shapeType][previewShapeInfo.direction];
  previewColor = parseInt(Math.random() * COLORS.length) + 1;
  currentX = getCenter(map.width, currentShape.width);
  currentY = 0;
  stopped = true;
  paused = false;
  score = 0;
  gameOver = false;
}

function startTimer() {
  timer = setInterval(tick, INTERVAL);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function restart() {
  reset();
  drawGame();
  //drawGrid();
  startTimer();
  stopped = false;
  paused = false;
  updateButtonText();
}

function accept() {
  map.addShape(currentShape.shape, currentX, currentY, currentColor);

  var delay = 0;
  //Find full rows, and remove
  var fullRows = map.findFullRows();
  if (fullRows.length > 0) {
    clearRows(fullRows);
    delay = 320;
  }

  // Delay the remaining work to allow GUI to highlight
  // the rows being removed.
  setTimeout(function() {
    //Update score
    if (fullRows.length > 0) {
      updateScore(fullRows.length);
    }
    map.removeFullRows();

    //Prepare the next one
    currentShape = previewShape;
    currentShapeInfo = previewShapeInfo;
    currentColor = previewColor;
    currentX = getCenter(map.width, currentShape.width);
    previewShapeInfo = generateShapeInfo();
    previewShape =
      shapeObjects[previewShapeInfo.shapeType][previewShapeInfo.direction];
    previewColor = parseInt(Math.random() * COLORS.length) + 1;

    //Try put the entire shape. If we can't, it means 'game over'.
    if (map.canPut(currentShape.shape, currentX, 0)) {
      currentY = 0;
      if (delay == 0) {
        drawShape(currentShape.shape, currentX, currentY);
        drawPreview(
          previewShape.shape,
          getCenter(4, previewShape.width),
          getCenter(4, previewShape.height),
          layout.previewBlockSize
        );
      } else {
        drawGame();
      }
    } else {
      //GAME OVER

      //We still leave one more shape. It can only be showed partly in the map.
      //Figure out which part we can show
      currentY = -currentShape.height;
      for (var startY = 1; startY < currentShape.height; startY++) {
        if (map.canPutPart(currentShape.shape, currentX, -startY, startY)) {
          currentY = -startY;
          break;
        }
      }

      stopped = true;
      paused = false;
      gameOver = true;
      drawGame();
      stopTimer();
    }
  }, delay);
}

function tick() {
  if (paused) {
    return;
  }

  if (goDown()) {
    return;
  }

  accept();
}

function updateScore(rowCount) {
  var scores = [10, 30, 60, 100];
  score += scores[rowCount - 1];
}

function goDown() {
  return tryPut(currentShape, 0, 1, currentShapeInfo);
}

function goDownDirectly() {
  while (goDown()) {}
}

function goLeft() {
  return tryPut(currentShape, -1, 0, currentShapeInfo);
}

function goRight() {
  return tryPut(currentShape, 1, 0, currentShapeInfo);
}

function tryPut(shapeObject, relativeX, relativeY, nextShapeInfo) {
  if (
    map.canPut(shapeObject.shape, currentX + relativeX, currentY + relativeY)
  ) {
    clearShape(currentShape.shape, currentX, currentY);
    currentShape = shapeObject;
    currentShapeInfo = nextShapeInfo;
    currentX += relativeX;
    currentY += relativeY;
    drawShape(currentShape.shape, currentX, currentY);
    return true;
  } else {
    return false;
  }
}

function goRotate() {
  var nextShapeInfo = {
    shapeType: currentShapeInfo.shapeType,
    direction: (currentShapeInfo.direction + 1) % 4
  };
  var nextShape =
    shapeObjects[nextShapeInfo.shapeType][nextShapeInfo.direction];
  var relativeX = parseInt((currentShape.width - nextShape.width) / 2);

  return (
    tryPut(nextShape, relativeX, 0, nextShapeInfo) ||
    (relativeX < 0 && tryPut(nextShape, 0, 0, nextShapeInfo)) ||
    retryRotate(true, nextShape, nextShapeInfo) ||
    retryRotate(false, nextShape, nextShapeInfo)
  );
}

function retryRotate(onX, nextShape, nextShapeInfo) {
  var tryCount = onX
    ? nextShape.width - currentShape.width
    : nextShape.height - currentShape.height;
  var relativeX = 0;
  var telativeY = 0;
  if (onX) {
    relativeX = -1;
  } else {
    relativeY = -1;
  }
  while (tryCount > 0) {
    if (
      map.canPut(currentShape.shape, currentX + relativeX, currentY + telativeY)
    ) {
      if (tryPut(nextShape, relativeX, telativeY, nextShapeInfo)) {
        return true;
      } else {
        if (onX) {
          relativeX = relativeX - 1;
        } else {
          telativeY = telativeY - 1;
        }
      }
    } else {
      break;
    }
    tryCount--;
  }

  return false;
}

function generateShapeInfo() {
  return {
    shapeType: parseInt(Math.random() * SHAPES.length),
    direction: parseInt(Math.random() * 4)
  };
}

function getCenter(containerLength, shapeLength) {
  return Math.floor((containerLength - shapeLength) / 2);
}

function createMap(width, height) {
  var map = [];
  map.width = width;
  map.height = height;

  (function init() {
    for (var i = 0; i < map.height; i++) {
      map[i] = [];
      for (var j = 0; j < map.width; j++) {
        map[i][j] = 0;
      }
    }
  })();

  map.isRowFull = function(row) {
    for (var i = 0; i < map.width; i++) {
      if (map[row][i] === 0) {
        return false;
      }
    }
    return true;
  };

  map.copyRow = function(destRow, srcRow) {
    for (var i = 0; i < map.width; i++) {
      map[destRow][i] = map[srcRow][i];
    }
  };

  map.fillRow = function(row, value) {
    for (var i = 0; i < map.width; i++) {
      map[row][i] = value;
    }
  };

  map.findFullRows = function() {
    var ret = [];
    for (var i = 0; i < map.height; i++) {
      if (map.isRowFull(i)) {
        ret.push(i);
      }
    }
    return ret;
  };

  map.removeFullRows = function() {
    var i = map.height - 1;
    while (i >= 0 && !map.isRowFull(i)) {
      i--;
    }
    var j = i - 1;
    while (j >= 0) {
      while (j >= 0 && map.isRowFull(j)) {
        j--;
      }
      if (j >= 0) {
        map.copyRow(i, j);
        i--;
        j--;
      }
    }
    while (i >= 0) {
      map.fillRow(i, 0);
      i--;
    }
  };

  map.canPutPart = function(shape, x, y, startY) {
    for (var i = 0; i < 4; i++) {
      if (shape[i].y < startY) {
        continue;
      }
      var tx = shape[i].x + x;
      var ty = shape[i].y + y;
      if (ty >= map.height || ty < 0) {
        return false;
      }
      if (tx >= map.width || tx < 0) {
        return false;
      }
      if (map[ty][tx] > 0) {
        return false;
      }
    }
    return true;
  };

  map.canPut = function(shape, x, y) {
    return map.canPutPart(shape, x, y, 0);
  };

  map.addShape = function(shape, x, y, colorIndex) {
    shape.forEach(function(point) {
      map[point.y + y][point.x + x] = colorIndex;
    });
  };

  return map;
}

function createShapeObjects() {
  function rotate(shape) {
    var newShape = [];
    var min = 0;
    shape.forEach(function(point, i) {
      newShape[i] = {};
      newShape[i].x = -point.y;
      if (newShape[i].x < min) {
        min = newShape[i].x;
      }
      newShape[i].y = point.x;
    });
    newShape.forEach(function(point) {
      point.x += -min;
    });
    return newShape;
  }

  function shapeWidth(shape) {
    var len = 0;
    shape.forEach(function(point) {
      if (point.x > len) {
        len = point.x;
      }
    });
    return len + 1;
  }

  function shapeHeight(shape) {
    var len = 0;
    shape.forEach(function(point) {
      if (point.y > len) {
        len = point.y;
      }
    });
    return len + 1;
  }

  var shapeObjects = [];
  SHAPES.forEach(function(rawShape, i) {
    var shapeSerials = [];
    shapeSerials[0] = {
      shape: rawShape,
      width: shapeWidth(rawShape),
      height: shapeHeight(rawShape)
    };
    for (var j = 0; j < 3; j++) {
      var rotatedShape = rotate(shapeSerials[j].shape);
      shapeSerials.push({
        shape: rotatedShape,
        width: shapeWidth(rotatedShape),
        height: shapeHeight(rotatedShape)
      });
    }
    shapeObjects.push(shapeSerials);
  });
  return shapeObjects;
}
