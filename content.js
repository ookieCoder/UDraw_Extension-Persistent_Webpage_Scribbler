(() => {
  if (window.__scribblerInjected) return;
  window.__scribblerInjected = true;

  const pageKey = `scribble:${location.origin}${location.pathname}`;

  let strokes = [];
  let currentStroke = null;
  let drawing = false;
  let drawEnabled = false;
  let toolMode = "draw"; // draw | erase
  let drawColor = "#ff0000";
  let drawWidth = 2;
  let toolbarVisible = true;
  let undoStack = [];
  let redoStack = [];
  let erasingSessionActive = false;

  /* ---------------- Canvas ---------------- */

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  Object.assign(canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    zIndex: "2147483646",
    pointerEvents: "none"
  });

  document.documentElement.appendChild(canvas);

  function resizeCanvas() {
    canvas.width = document.documentElement.scrollWidth;
    canvas.height = document.documentElement.scrollHeight;
    redrawAll();
  }

  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(document.documentElement);

  function docPos(e) {
    return {
      x: e.clientX + window.scrollX,
      y: e.clientY + window.scrollY
    };
  }

  /* ---------------- Storage ---------------- */

  chrome.storage.local.get(pageKey, (res) => {
    strokes = Array.isArray(res[pageKey]) ? res[pageKey] : [];
    redrawAll();
  });

  function save() {
    chrome.storage.local.set({ [pageKey]: strokes });
  }

  function strokeIntersects(stroke, pos, radius) {
    return stroke.points.some(
      p => Math.hypot(p.x - pos.x, p.y - pos.y) <= radius
    );
  }

  /* ---------------- Drawing ---------------- */

  canvas.addEventListener("mousedown", (e) => {
    if (!drawEnabled || toolMode !== "draw") return;

    drawing = true;

    // UNDO SNAPSHOT HERE (ONLY ONCE)
    undoStack.push(JSON.parse(JSON.stringify(strokes)));
    redoStack.length = 0;
    updateUI();

    const p = docPos(e);
    currentStroke = {
      color: drawColor,
      width: drawWidth,
      points: [p]
    };

    ctx.beginPath();
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawWidth;
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawEnabled) return;

    const p = docPos(e);

    // DRAW MODE
    if (toolMode === "draw" && drawing) {
      currentStroke.points.push(p);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }

    // ERASE MODE
    if (toolMode === "erase") {
      if (!erasingSessionActive) {
        undoStack.push(JSON.parse(JSON.stringify(strokes)));
        redoStack.length = 0;
        erasingSessionActive = true;
        updateUI();
      }

      const R = 12;
      const before = strokes.length;

      strokes = strokes.filter(
        stroke => !strokeIntersects(stroke, p, R)
      );

      if (strokes.length !== before) {
        redrawAll();
        save();
      }
    }
  });

  window.addEventListener("mouseup", () => {
    if (drawing) {
      drawing = false;
      strokes.push(currentStroke);
      save();
    }
    erasingSessionActive = false;
  });

  function eraseAt(pos, radius) {
    let changed = false;

    strokes = strokes
      .map(stroke => {
        const pts = stroke.points.filter(
          p => Math.hypot(p.x - pos.x, p.y - pos.y) > radius
        );
        if (pts.length !== stroke.points.length) changed = true;
        return pts.length > 1 ? { ...stroke, points: pts } : null;
      })
      .filter(Boolean);

    if (changed) {
      redrawAll();
      save();
    }
  }

  function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      s.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
      );
      ctx.stroke();
    }
  }

  /* ---------------- Toolbar ---------------- */

  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    position: "fixed",
    top: "10px",
    left: "10px",
    zIndex: "2147483647",
    background: "#fff",
    border: "1px solid #888",
    padding: "8px",
    fontFamily: "sans-serif"
  });

  toolbar.innerHTML = `
    <button id="toggle">Start Drawing</button>
    <button id="undo" disabled>Undo</button>
    <button id="redo" disabled>Redo</button><br><br>
    <input type="color" id="color" value="${drawColor}">
    <input type="range" id="width" min="1" max="10" value="${drawWidth}">
    <button id="eraser">Eraser</button>
    <button id="clear">Clear</button>
    <button id="export">Export</button>
  `;

  document.body.appendChild(toolbar);
  const $ = id => toolbar.querySelector(id);

  $("#toggle").onclick = () => {
    drawEnabled = !drawEnabled;
    toolMode = "draw";
    canvas.style.pointerEvents = drawEnabled ? "auto" : "none";
    canvas.style.cursor = "default";
    $("#toggle").innerText = drawEnabled ? "Stop Drawing" : "Start Drawing";
  };

  $("#eraser").onclick = () => {
    drawEnabled = true;
    toolMode = "erase";
    $("#toggle").innerText = "Stop Drawing";
    canvas.style.pointerEvents = "auto";
    canvas.style.cursor = "crosshair";
  };

  $("#undo").onclick = () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.parse(JSON.stringify(strokes)));
    strokes = undoStack.pop();
    save();
    redrawAll();
    updateUI();
  };

  $("#redo").onclick = () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.parse(JSON.stringify(strokes)));
    strokes = redoStack.pop();
    save();
    redrawAll();
    updateUI();
  };

  $("#clear").onclick = () => {
    undoStack.push(JSON.parse(JSON.stringify(strokes)));
    redoStack.length = 0;
    strokes = [];
    save();
    redrawAll();
    updateUI();
  };

  $("#export").onclick = () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL();
    a.download = "scribble.png";
    a.click();
  };

  $("#color").oninput = e => drawColor = e.target.value;
  $("#width").oninput = e => drawWidth = +e.target.value;

  function updateUI() {
    $("#undo").disabled = undoStack.length === 0;
    $("#redo").disabled = redoStack.length === 0;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_TOOLBAR") {
      toolbarVisible = !toolbarVisible;

      toolbar.style.display = toolbarVisible ? "block" : "none";

      // Also disable drawing when hidden
      if (!toolbarVisible) {
        drawEnabled = false;
        toolMode = "draw";
        canvas.style.pointerEvents = "none";
        $("#toggle").innerText = "Start Drawing";
      }
    }
  });

})();
