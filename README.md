# Unholium

A modern-day 2D top-down RPG, native on Windows. This folder is the official development baseline: every update builds on it.

## Run

- `dist\Unholium.exe`: the game.
- `dist\Unholium Creation Tool.exe`: the world editor.

Saves, worlds and wallpapers live next to the exes (`dist\data`, `dist\worlds`, `dist\wallpapers`). Errors are written to `dist\data\errors.log`.

## How it is put together

- **Game code**: `js\`. About 270 scripts in a strict load order, later scripts wrapping earlier ones. `js\scripts.txt` is the list of that order.
- **Runtime**: `native\`. V8 (through Node), Skia on the GPU (skia-canvas), sound (node-web-audio-api, plus `compressor_worklet.js`, the browser's compressor), gamepads (SDL3, with XInput as a fallback).
  - `runtime.js`: everything the game asks of its surroundings. `main.js`: the game's window.
  - `net.js`: co-op. `ai.js`: AI dialogue, key encrypted for the Windows user. `migrate.js`: imports saves from the old build, once, from a copy.
  - `ui.js`: the interface toolkit. `tool.js`: the Creation Tool's window. `editor\`: the Creation Tool's logic.
  - `build.js`: builds `dist`.
- **Controller**: `js\game\pad.js`. Settings > Controller rebinds every action.

## Everyday commands

Node lives in `tools\node`. From `native\`:

```
..\tools\node\node.exe main.js                 run the game
..\tools\node\node.exe tool.js                 run the Creation Tool
..\tools\node\node.exe build.js                build dist
bash run_all.sh                                every game test group
..\tools\node\node.exe test_runner.js <group>  one group
..\tools\node\node.exe tool_test.js            the Creation Tool's checks
..\tools\node\node.exe tool_test.js ui         the Creation Tool by pointer and keys
..\tools\node\node.exe world_test.js           a world made in the tool, opened by the game
..\tools\node\node.exe host_test.js            co-op sockets and AI forwarding
..\tools\node\node.exe pixel_test.js           the picture against native\baseline
```

Keep everything on D:. `tools\apply_edits.pl` applies batches of edits to `js\`.

## Rules for the content

Every text exists in English and Brazilian Portuguese. Lore comes from the author: placeholders stay until it is written.
