(() => {
  if (window.__scribblerInjected) return;
  window.__scribblerInjected = true;

  const pageKey = `scribble:${location.origin}${location.pathname}`;

  let strokes = [], currentStroke = null, drawing = false, drawEnabled = false;
  let toolMode = "draw", toolbarVisible = true, erasingSessionActive = false;
  let drawColor = "#ff0000", drawWidth = 2, undoStack = [], redoStack = [];

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

  /* ---------------- Drawing ---------------- */

  canvas.addEventListener("mousedown", (e) => {
    if (!drawEnabled || toolMode !== "draw") return;
    drawing = true;
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

  function strokeIntersects(stroke, pos, radius) {
    return stroke.points.some(
      p => Math.hypot(p.x - pos.x, p.y - pos.y) <= radius
    );
  }

  /* ---------------- Toolbar ---------------- */
  const toolbar = document.createElement("div");
  toolbar.id = "toolbar";
  Object.assign(toolbar.style, {
    position: "fixed",
    top: "16px",
    left: "16px",
    zIndex: "2147483647",
    backgroundColor: "#ffffff",
    color: "#000000",
    border: "2px solid #000000",
    borderRadius: "8px",
    padding: "12px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "15px",
    width: "220px",
  });

  toolbar.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px">
      <button id="toggle" class="primary">
        ✏️ Start Drawing
      </button>
      <div class="row">
        <button id="undo" disabled>↶ Undo</button>
        <button id="redo" disabled>↷ Redo</button>
      </div>
      <hr>
      <label class="label">
        Color
        <input type="color" id="color" value="${drawColor}">
      </label>
      <label class="label">
        Stroke Width
        <input type="range" id="width" min="1" max="12" value="${drawWidth}">
      </label>
      <div class="row">
        <button id="eraser">🧽 Eraser</button>
        <button id="clear">🗑 Clear</button>
      </div>
      <button id="export">📤 Export</button>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #toolbar,
    #toolbar * {
      background: #000000 !important;
      color: #ffffff !important;
      border-color: #ffffff !important;
    }

    #toolbar button,
    #toolbar input {
      border: 1px solid #ffffff !important;
      padding: 4px !important;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toolbar);
  const $ = id => toolbar.querySelector(id);

  $("#toggle").onclick = () => {
    drawEnabled = !drawEnabled;
    toolMode = "draw";
    canvas.style.pointerEvents = drawEnabled ? "auto" : "none";
    canvas.style.cursor = "default";
    $("#toggle").innerText = drawEnabled ? "Stop Drawing" : "✏️ Start Drawing";
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
      // Disable drawing when hidden
      if (!toolbarVisible) {
        drawEnabled = false;
        toolMode = "draw";
        canvas.style.pointerEvents = "none";
        $("#toggle").innerText = "Start Drawing";
      }
    }
  });

})();
