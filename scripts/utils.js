import { getState } from './state.js';
import { config } from './config.js';

export function isValid(r, c) {
    const { gridRows, gridCols } = getState();
    return r >= 0 && r < gridRows && c >= 0 && c < gridCols;
}

export function isNeighbor(cell1, cell2) {
    if (!cell1 || !cell2) return false;
    const r1 = parseInt(cell1.dataset.row);
    const c1 = parseInt(cell1.dataset.col);
    const r2 = parseInt(cell2.dataset.row);
    const c2 = parseInt(cell2.dataset.col);
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function getCellCenter(cell, puzzleGridElement) {
    const gridRect = puzzleGridElement.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const x = (cellRect.left + cellRect.width / 2) - gridRect.left;
    const y = (cellRect.top + cellRect.height / 2) - gridRect.top;
    return { x, y };
}

export function getRelativeCoords(e, puzzleGridElement) {
    const gridRect = puzzleGridElement.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return {
        x: clientX - gridRect.left,
        y: clientY - gridRect.top
    };
}

export function calculateCellSize(rows, cols, baseSize) {
    const containerPadding = 60;
    const gridBorder = 4;
    const availableWidth = window.innerWidth - containerPadding - gridBorder;
    const availableHeight = window.innerHeight * 0.6 - gridBorder;
    const maxCellWidth = Math.floor(availableWidth / cols);
    const maxCellHeight = Math.floor(availableHeight / rows);
    let size = Math.min(maxCellWidth, maxCellHeight);
    size = Math.min(size, baseSize);
    size = Math.max(config.MIN_CELL_SIZE, size);
    return size;
}

export function isWallBetween(r1, c1, r2, c2, wallPositions) {
    if (!wallPositions || wallPositions.size === 0) {
        return false;
    }
    let wallKey;
    if (r1 === r2) {
        const leftCol = Math.min(c1, c2);
        wallKey = `V_${r1}_${leftCol}`;
    } else {
        const topRow = Math.min(r1, r2);
        wallKey = `H_${topRow}_${c1}`;
    }
    return wallPositions.has(wallKey);
}