# <img src="assets/logo.png" width="35"/> Zip-It! Puzzle Game

A challenging, responsive, web-based puzzle game where you must connect numbered cells in sequence, filling the entire grid within the time limit, respecting walls and passing through waypoints, and finishing precisely on the last number.

Built with HTML, CSS, and modern JavaScript (ES6 Modules).

## How to Play

1.  **Start:** Click/Tap on the cell containing '1'. This selects the first cell.
2.  **Draw/Select:**
    *   **Drag:** Click/Tap and hold on the last cell in the path, then drag your mouse/finger to adjacent (up, down, left, right) cells to extend the path, provided there isn't a wall blocking the way.
    *   **Click:** Alternatively, click/tap an adjacent, unselected cell to add it to the path, provided there isn't a wall between the last cell and the clicked cell. Clicking/tapping the second-to-last cell in the path removes the last step (undo).
3.  **Sequence:** Enter numbered cells in ascending order (1 -> 2 -> 3...). Empty cells can be traversed freely between numbers, respecting walls.
4.  **Walls:** Thick lines between cells are walls and cannot be crossed by the path.
5.  **Waypoints:** Cells marked with a grey dot are waypoints. The path *must* pass through all waypoint cells to be valid. Waypoints turn darker once visited.
6.  **Fill & End:** After connecting the highest number for the level, continue until *all* cells are filled. The path *must* pass through all waypoints and *must end* on the highest numbered cell.
7.  **Goal:** Complete the path covering all cells, following the number sequence, passing through all waypoints, without crossing walls, ending correctly, before the timer runs out.
8.  **Controls:**
    *   **Drawing/Selecting:** Click/Tap and drag from the last cell OR click/tap adjacent cells. Movement is blocked by walls. Click/Tap the *second-to-last* cell in the path to undo the last step.
    *   **Undo Button:** Removes the last path segment (cannot be used while drawing or paused).
    *   **Clear Path:** Removes the entire currently drawn path (cannot be used while drawing or paused). Resets numbers to visible.
    *   **Reset Level:** Restarts the current level attempt. Costs **10 points** (unless on Level 1 or points < 10). Keeps level number (cannot be used while paused).
    *   **Restart Game:** Confirms via modal, then resets game to Level 1, Points 0 and starts the new game immediately.
    *   **Pause/Continue:** Pauses the timer and saves the game state. Click again to resume. Game also auto-pauses if you switch browser tabs or minimize the window. A visual overlay indicates the paused state.
    *   **Next Level:** Appears only after completing a level successfully (including visiting all waypoints).
    *   **Sound: On/Off:** Toggles game sound effects. Preference is saved.

## Features

*   Challenging path-drawing puzzle connecting numbers sequentially.
*   Supports both drag-and-draw and click-to-select path creation.
*   **Walls:** Introduces walls between cells that block path movement.
*   **Waypoints:** Adds mandatory cells (marked with dots) that the path must pass through, increasing complexity.
*   Requires complete grid coverage and ending on the final number.
*   **Randomized Gradient Path:** Drawn path features a unique 2-color gradient for each new level attempt. Temporary drag line blends with the path color.
*   **Guaranteed solvable levels:** Generates a valid path first, then adds walls/waypoints strategically based on that path.
*   **Asynchronous level generation** prevents UI freezes (using Web Workers).
*   Progressive difficulty across levels (grid size, numbers, walls, waypoints).
*   Timed challenge per level with **Pause/Continue** & auto-pause.
*   Scoring system: Points for level completion + time bonus; penalty for resetting.
*   **Full Game State Persistence:** Saves level, points, timer, puzzle layout (walls, waypoints), path progress, and pause state locally.
*   Sound effects toggle with saved preference.
*   Undo (button and click-back) and Clear Path functionality.
*   Clear visual feedback (path lines scale, distinct walls, gradient path, waypoints).
*   Restart confirmation modal.
*   **Responsive design**.
*   Touch controls supported.
*   **Refined Messaging**.
*   **Pause Overlay**.
*   **Modular Codebase**.
*   **Organized File Structure**.
*   Smoother UI & Restart Flow.
*   Stable grid size during level generation.

## Scoring Logic (Points)

*   **Level Completion:** `Points Increase = (Level * 10) + Time Remaining`
*   **Reset Level:** `Points Change = -10` (Cannot reset if Level > 1 and Points < 10. Points cannot go below 0).
*   **Pause Game:** No points change.
*   **Restart Game:** Points reset to 0.
*   **Time Out During Play:** Saved Points reset to 0 upon next page load.

## Level Difficulty Design

Difficulty progresses based on level thresholds (summary):

| Levels    | Grid Size | xCells (Max 20) | Walls     | Waypoints | Base Cell Size | Time Addition |
| :-------- | :-------- | :-------------- | :-------- | :-------- | :------------- | :------------ |
| 1-10      | 4x4       | 5               | 0         | 0         | 70px           | +0s           |
| 11-20     | 4x4       | 6               | 1         | 0         | 70px           | +0s           |
| 21-40     | 5x5       | 7-8             | 2         | 0         | 65px           | +5s           |
| 41-60     | 5x5       | 8-9             | 3         | 0         | 65px           | +5s           |
| 61-80     | 6x6       | 9-10            | 4         | 1         | 60px           | +10s          |
| 81-100    | 6x6       | 10-11           | 5         | 1         | 60px           | +10s          |
| 101-120   | 7x7       | 11-12           | 6         | 2         | 56px           | +15s          |
| 121-140   | 7x7       | 12-13           | 8         | 2         | 56px           | +15s          |
| 141-160   | 7x8       | 13-14           | 10        | 3         | 55px           | +20s          |
| 161-180   | 7x8       | 14-15           | 12        | 3         | 55px           | +20s          |
| 181-200   | 8x8       | 15-16           | 15        | 4         | 54px           | +25s          |
| 201-220   | 8x8       | 16-17           | 18        | 4         | 54px           | +25s          |
| 221-240   | 8x9       | 17-18           | 21        | 5         | 53px           | +30s          |
| 241-260   | 8x9       | 18-19           | 24        | 5         | 53px           | +30s          |
| 261-280   | 9x9       | 19-20           | 28        | 6         | 52px           | +35s          |
| 281-300   | 9x9       | 20              | 32        | 6         | 52px           | +35s          |
| 301+      | 10x10     | 20              | 40        | 8         | 52px           | +50s          |

*   **Actual Cell Size:** Dynamically calculated based on screen size, up to the Base Cell Size (min 35px).
*   **Total Time Limit:** `60 seconds + Time Addition`
*   **Wall/Waypoint Count:** Subject to generation constraints.

## Setup

1.  Clone or download this repository.
2.  Ensure the following file structure:
    ```
    your-project-folder/
    ├── index.html
    ├── styles/
    │   └── style.css
    ├── scripts/
    │   ├── config.js
    │   ├── state.js
    │   ├── utils.js
    │   ├── ui.js
    │   ├── audio.js
    │   ├── persistence.js
    │   ├── timer.js
    │   ├── levelGenerator.js
    │   ├── logic.js
    │   ├── input.js
    │   ├── main.js           # Main JS entry point
    │   └── pathfinder.js     # Web Worker
    └── assets/
        ├── logo.png
        ├── favicon.png
        ├── tick.mp3
        ├── error.mp3
        ├── win.mp3
        └── lose.mp3
    ```
3.  Verify all required assets are present in the `assets/` folder.
4.  Open `index.html` in a modern web browser supporting ES6 Modules, Web Workers, and `localStorage`. *(Note: If running locally, you might need a simple local server due to ES6 module security restrictions in some browsers when opened directly via `file:///`)*.

## Future Enhancements Potential

*   Visual themes.
*   High score board display.
*   Tutorial mode.
*   Tunnels / Bridges.
*   Conditional Walls / Gates.
*   More sophisticated wall/waypoint placement algorithms.