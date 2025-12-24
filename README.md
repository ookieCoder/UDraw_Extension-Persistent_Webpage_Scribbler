# UDraw Extension — Persistent Webpage Scribbler

A lightweight browser extension that enables persistent scribbling and drawing on webpages.

This extension injects drawing tools into web pages so users can sketch, and visually mark content across sessions. Drawings remain persistent across page reloads until cleared.

> This project contains a browser extension with a manifest, background script, content script, and supporting assets.

## Features

- Insert a drawing layer on any webpage
- Use freehand drawing tools directly in-browser
- Persist drawn annotations across reloads
- Simple and minimal UI
- Runs as an installable browser extension

## Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/ookieCoder/UDraw_Extension-Persistent_Webpage_Scribbler.git
   cd UDraw_Extension-Persistent_Webpage_Scribbler
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the project directory

The extension should now be installed and active.

## Usage

Open [this](https://microsoftedge.microsoft.com/addons/detail/udraw-persistent-webpag/hdhfmgcbocaganecnfibmklhndoajnkl) in Mircosoft Edge Browser to get the extension.
   - Click the extension icon in the toolbar to toggle drawing mode
   - Use the toolbar to adjust settings (color, stroke width)
   - Draw on the webpage
   - Drawings persist across page reloads

## Scripts

1. **background.js** : Handles extension lifecycle events.

2. **content.js** : Injects drawing UI and logic into webpage DOM.

3. **manifest.json** : Chrome extension configuration (permissions, scripts, icons).
