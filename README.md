# <img src="assets/logo.png" width="50"/> Zip-IT Puzzle Game

A challenging web-based puzzle game where you must connect numbered cells in sequence while filling the entire grid within the time limit.

## How to Play

1.  **Start:** Click and hold on the cell containing the number '1'. A path can only begin here.
2.  **Draw:** Drag your mouse to adjacent (up, down, left, right) cells to draw a path.
3.  **Sequence:** You must enter cells containing numbers in ascending order (1 -> 2 -> 3...). You can traverse empty cells freely between numbers.
4.  **Fill:** After connecting the highest number for the level, continue drawing the path until *all* remaining empty cells in the grid are filled.
5.  **Goal:** Successfully draw a single, continuous path that starts at '1', visits all numbered cells in sequence, and covers every cell in the grid before the time runs out.
6.  **Controls:**
    *   **Undo:** Removes the last segment of your current path. Can be used multiple times, but not while actively drawing (mouse button held down).
    *   **Reset Level:** Restarts the *current* level attempt with a fresh grid and resets the timer. Your current score and level number are kept. Use this if you get stuck or run out of time.
    *   **Restart Game:** Resets the entire game back to Level 1 and sets the score to 0. Your progress is saved at Level 1 / Score 0.
    *   **Next Level:** Appears after successfully completing a level, allowing you to proceed.

## Features

*   Sequential number connection mechanic.
*   Requires complete grid coverage by the path.
*   Progressive difficulty across levels.
*   Timed challenge for each level.
*   Scoring system with time bonus.
*   Game progress (score and current level) saved in `localStorage` to resume playing later.
*   Sound effects for feedback.
*   Undo functionality.
*   Clear visual feedback for the path and selected cells.

## Scoring Logic

Your score increases only when you successfully complete a level. The points awarded are calculated as follows:

*   **Base Level Points:** You receive `Current Level Number * 10` points.
    *   *Example: Completing Level 5 gives 5 * 10 = 50 base points.*
*   **Time Bonus:** You receive points equal to the number of seconds remaining on the timer when you completed the level.
    *   *Example: Finishing Level 5 with 45 seconds left gives a 45 point time bonus.*
*   **Total Score Increase:** `(Level * 10) + Time Remaining`
    *   *Example: Completing Level 5 with 45 seconds left increases your score by 50 + 45 = 95 points.*

The score accumulates across levels and is only reset to 0 when you use the "Restart Game" button.

## Level Difficulty Design

The game aims for a gradual increase in difficulty with caps to prevent excessively large or complex grids:

*   **Starting Point (Level 1):**
    *   Grid Size: 5x5
    *   Numbered Cells: 5
    *   Time Limit: 120 seconds
*   **Numbered Cells Increase:** The number of required sequential cells (`xCells`) increases by 1 every 10 levels.
    *   *Example: Levels 1-10 have 5 numbers, Levels 11-20 have 6 numbers, etc.*
    *   **Maximum Numbered Cells:** Capped at **13**.
*   **Grid Size Increase:** The grid dimensions increase by 1 (e.g., 5x5 to 6x6) every 15 levels.
    *   *Example: Levels 1-15 are 5x5, Levels 16-30 are 6x6, etc.*
    *   **Maximum Grid Size:** Capped at **7x7**.
*   **Time Limit Increase:** The base time limit increases by 10 seconds for each level past Level 1.
    *   *Example: Level 1 = 120s, Level 2 = 130s, Level 10 = 210s.*

This ensures a smoother difficulty curve that remains manageable even at higher levels.

## Setup

1.  Clone or download this repository.
2.  Ensure you have the following file structure:
    ```
    your-project-folder/
    ├── index.html
    ├── script.js
    ├── style.css
    └── assets/
        ├── logo.png
        ├── favicon.png  (optional)
        ├── tick.mp3
        ├── error.mp3
        ├── win.mp3
        └── lose.mp3
    ```
3.  Make sure all required images (`logo.png`, `favicon.png`) and sound files (`tick.mp3`, `error.mp3`, `win.mp3`, `lose.mp3`) are present in the `assets/` folder.
4.  Open `index.html` in a modern web browser.

## Future Enhancements Potential

*   Guaranteed solvable puzzle generation (currently relies on random placement + game rules).
*   More varied level progression rules.
*   Visual themes.
*   Touch controls for mobile devices.
*   High score board display.
*   Tutorial mode for first-time players.