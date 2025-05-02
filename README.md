# <img src="assets/logo.png" width="50"/> Zip-IT Puzzle Game

A challenging web-based puzzle game where you must connect numbered cells in sequence, filling the entire grid within the time limit, and finishing precisely on the last number.

## How to Play

1.  **Start:** Click and hold (or tap and hold) on the cell containing the number '1'. A path can only begin here.
2.  **Draw:** Drag your mouse (or finger) to adjacent (up, down, left, right) cells to draw a path.
3.  **Sequence:** You must enter cells containing numbers in ascending order (1 -> 2 -> 3...). You can traverse empty cells freely between numbers.
4.  **Fill & End:** After connecting the highest number for the level, continue drawing the path until *all* remaining empty cells in the grid are filled. The path *must end* on the cell containing the highest number for the level.
5.  **Goal:** Successfully draw a single, continuous path that starts at '1', visits all numbered cells in sequence, covers every cell in the grid, ends on the highest number, and is completed before the time runs out.
6.  **Controls:**
    *   **Undo:** Removes the last segment of your current path. Can be used multiple times, but not while actively drawing.
    *   **Reset Level:** Restarts the *current* level attempt with a fresh grid and resets the timer. Your score and level number are kept.
    *   **Restart Game:** Shows a confirmation prompt. If confirmed, resets the entire game back to Level 1 and sets the score to 0. Your progress is saved at Level 1 / Score 0.
    *   **Next Level:** Appears only after successfully completing a level, allowing you to proceed.

## Features

*   Challenging path-drawing puzzle connecting numbers in sequence.
*   Requires complete grid coverage and ending on the final number.
*   **Guaranteed solvable levels** using Hamiltonian path generation.
*   **Asynchronous level generation** prevents UI freezes on complex levels (using Web Workers).
*   Progressive difficulty across levels with updated rules.
*   Timed challenge for each level.
*   Scoring system with time bonus.
*   Game progress (score and current level) saved in `localStorage`.
*   Sound effects for feedback.
*   Undo functionality.
*   Clear visual feedback for path and selected cells (lines are now thicker).
*   **Restart confirmation modal** to prevent accidental progress loss.
*   **Responsive touch controls** for mobile/tablet play.

## Scoring Logic

Your score increases only when you successfully complete a level. The points awarded are calculated as follows:

*   **Base Level Points:** `Current Level Number * 10` points.
*   **Time Bonus:** Points equal to the number of seconds remaining on the timer.
*   **Total Score Increase:** `(Level * 10) + Time Remaining`

The score accumulates across levels and is only reset to 0 when you confirm via the "Restart Game" modal.

## Level Difficulty Design

Difficulty increases gradually based on the level number:

*   **Grid Size:**
    *   Starts at 5x5 (Levels 1-15).
    *   Increases by 1 (e.g., 5x5 -> 6x6) every 15 levels.
    *   Maximum grid size is **8x8** (Reached at Level 46+).
*   **Numbered Cells (`xCells`):**
    *   Starts at 5 (Levels 1-10).
    *   Increases by 1 every 10 levels.
    *   Maximum numbered cells is **14** (Reached at Level 91+).
    *   *Constraint:* The number of required cells cannot exceed the total cells available in the current grid size.
*   **Time Limit:**
    *   Calculated based on a base time, with adjustments added per level, plus factors for the current grid size and the number of required connections (`xCells`), ensuring more complex levels have proportionally more time.

This progression aims for a steady challenge curve as players advance.

## Setup

1.  Clone or download this repository.
2.  Ensure you have the following file structure:
    ```
    your-project-folder/
    ├── index.html
    ├── script.js
    ├── style.css
    ├── pathfinder.js  <-- Web Worker script
    └── assets/
        ├── logo.png
        ├── favicon.png
        ├── tick.mp3
        ├── error.mp3
        ├── win.mp3
        └── lose.mp3
    ```
3.  Make sure all required images and sound files are present in the `assets/` folder.
4.  Open `index.html` in a modern web browser that supports Web Workers.

## Future Enhancements Potential

*   **Obstacles:** Adding walls or blocked cells to the grid for increased complexity.
*   Visual themes.
*   High score board display.
*   Tutorial mode for first-time players.
*   More varied level progression rules or special level types.