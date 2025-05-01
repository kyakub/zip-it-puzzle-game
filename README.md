# Zip-IT Puzzle Game

![Zip-IT Logo](logo.png) <!-- Make sure logo.png exists -->

A simple web-based puzzle game where you connect numbers in sequence (1, 2, 3...) while filling the entire grid.

## How to Play

1.  **Start:** Click and hold on the cell containing the number '1'.
2.  **Draw:** Drag your mouse to adjacent cells.
3.  **Sequence:** You must connect the numbers in ascending order (1 -> 2 -> 3...).
4.  **Fill:** After connecting the highest number, continue drawing to fill *all* remaining empty cells.
5.  **Goal:** Successfully draw a single path that starts at '1', visits all numbers in sequence, and covers every cell in the grid before the time runs out.
6.  **Controls:**
    *   **Undo:** Removes the last step of your path.
    *   **Restart:** Resets the current level and timer. Starts back at Level 1 with score 0.
    *   **Next Level:** Appears after successfully completing a level.

## Features

*   Sequential number connection mechanic.
*   Grid must be completely filled by the path.
*   Increasing difficulty with levels (grid size and number count).
*   Timer adds a challenge.
*   Scoring system (persists across sessions using `localStorage`).
*   Sound effects for feedback.
*   Undo functionality.
*   Responsive design elements.

## Setup

1.  Clone or download this repository.
2.  Ensure you have the following asset files in the same directory:
    *   `index.html`
    *   `style.css`
    *   `script.js`
    *   `logo.png` (or replace the reference in `index.html`)
    *   `favicon.png` (optional, or replace reference)
    *   `tick.mp3`
    *   `error.mp3`
    *   `win.mp3`
    *   `lose.mp3`
3.  Open `index.html` in your web browser.

## Future Enhancements Potential

*   Guaranteed solvable puzzle generation (currently relies on random placement + game rules).
*   More sophisticated level progression.
*   Visual themes.
*   Touch controls for mobile.
*   High score board.
*   Tutorial mode.
*   Restore save/load progress functionality.