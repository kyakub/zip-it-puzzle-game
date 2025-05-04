# <img src="assets/logo.png" width="35"/> Zip-IT Puzzle Game

A challenging, responsive, web-based puzzle game where you must connect numbered cells in sequence, filling the entire grid within the time limit, and finishing precisely on the last number.

## How to Play

1.  **Start:** Click/Tap and hold on the cell containing '1'.
2.  **Draw:** Drag your mouse/finger to adjacent (up, down, left, right) cells.
3.  **Sequence:** Enter numbered cells in ascending order (1 -> 2 -> 3...). Empty cells can be traversed freely between numbers.
4.  **Fill & End:** After connecting the highest number for the level, continue until *all* cells are filled. The path *must end* on the highest numbered cell.
5.  **Goal:** Complete the path covering all cells, following the number sequence, ending correctly, before the timer runs out.
6.  **Controls:**
    *   **Undo:** Removes the last path segment (cannot be used while drawing or paused).
    *   **Clear Path:** Removes the entire currently drawn path (cannot be used while drawing or paused).
    *   **Reset Level:** Restarts the current level attempt. Costs **10 points** (unless on Level 1 or points < 10). Keeps level number (cannot be used while paused).
    *   **Restart Game:** Confirms via modal, then resets game to Level 1, Points 0. Pauses game first if active.
    *   **Pause/Continue:** Pauses the timer and saves the game state. Click again to resume. Game also auto-pauses if you switch browser tabs or minimize the window. A visual overlay indicates the paused state.
    *   **Next Level:** Appears only after completing a level successfully.
    *   **Sound: On/Off:** Toggles game sound effects. Preference is saved.

## Features

*   Challenging path-drawing puzzle connecting numbers sequentially.
*   Requires complete grid coverage and ending on the final number.
*   **Guaranteed solvable levels** using Hamiltonian path generation.
*   **Asynchronous level generation** prevents UI freezes (using Web Workers).
*   Progressive difficulty across levels with updated rules (up to 10x10 grid, 20 numbers max).
*   Timed challenge per level with **Pause/Continue** functionality & auto-pause.
*   Scoring system: Points awarded for level completion + time bonus; **penalty for resetting level (-10)**.
*   **Full Game State Persistence:** Saves level, points, timer, puzzle layout, path progress, and pause state locally. Resume exactly where you left off. *Note: If time runs out during active play, saved progress resets to Level 1 / Points 0 upon next load.*
*   Sound effects toggle with saved preference.
*   Undo and Clear Path functionality.
*   Clear visual feedback (path lines scale with grid size).
*   Restart confirmation modal.
*   **Responsive design** adapting grid size, UI elements, and font sizes.
*   Touch controls supported.
*   **Refined Messaging:** Non-critical messages are debounced.
*   **Pause Overlay:** Displays a message and blurs the grid when paused.

## Scoring Logic (Points)

*   **Level Completion:** `Points Increase = (Level * 10) + Time Remaining`
*   **Reset Level:** `Points Change = -10` (Cannot reset if Level > 1 and Points < 10. Points cannot go below 0).
*   **Pause Game:** No points change.
*   **Restart Game:** Points reset to 0.
*   **Time Out During Play:** Saved Points reset to 0 upon next page load.

## Level Difficulty Design

Difficulty progresses based on level thresholds (summary):

| Levels    | Grid Size | xCells (Max 20) | Base Cell Size | Time Addition |
| :-------- | :-------- | :-------------- | :------------- | :------------ |
| 1-10      | 4x4       | 5               | 70px           | +0s           |
| 11-20     | 4x4       | 6               | 70px           | +0s           |
| 21-40     | 5x5       | 7-8             | 65px           | +5s           |
| 41-60     | 5x5       | 8-9             | 65px           | +5s           |
| 61-80     | 6x6       | 9-10            | 60px           | +10s          |
| 81-100    | 6x6       | 10-11           | 60px           | +10s          |
| 101-120   | 7x7       | 11-12           | 56px           | +15s          |
| 121-140   | 7x7       | 12-13           | 56px           | +15s          |
| 141-160   | 7x8       | 13-14           | 55px           | +20s          |
| 161-180   | 7x8       | 14-15           | 55px           | +20s          |
| 181-200   | 8x8       | 15-16           | 54px           | +25s          |
| 201-220   | 8x8       | 16-17           | 54px           | +25s          |
| 221-240   | 8x9       | 17-18           | 53px           | +30s          |
| 241-260   | 8x9       | 18-19           | 53px           | +30s          |
| 261-280   | 9x9       | 19-20           | 52px           | +35s          |
| 281-300   | 9x9       | 20              | 52px           | +35s          |
| 301+      | 10x10     | 20              | 52px           | +50s          |

*   **Actual Cell Size:** Dynamically calculated based on screen size, up to the Base Cell Size (min 35px).
*   **Total Time Limit:** `60 seconds + Time Addition`

## Setup

1.  Clone or download this repository.
2.  Ensure the following file structure:
    ```
    your-project-folder/
    ├── index.html
    ├── script.js
    ├── style.css
    ├── pathfinder.js     # Web Worker
    └── assets/
        ├── logo.png
        ├── favicon.png
        ├── tick.mp3
        ├── error.mp3
        ├── win.mp3
        └── lose.mp3
    ```
3.  Verify all required assets are present in the `assets/` folder.
4.  Open `index.html` in a modern web browser supporting Web Workers and `localStorage`.

## Future Enhancements Potential

*   **Obstacles:** Adding walls or blocked cells.
*   Visual themes.
*   High score board display.
*   Tutorial mode.