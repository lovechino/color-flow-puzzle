import Phaser from 'phaser';
import type { Cell } from '../types';
import { COLOR_HEX } from '../config';
import {
  createEmptyGrid,
  populateGridFromLevel,
  getNeighbors,
  cloneGrid,
} from './GridLogic';

export { createEmptyGrid, populateGridFromLevel, getNeighbors, cloneGrid };

export function getCellAtPixel(
  grid: Cell[][],
  x: number,
  y: number,
  gridContainer: Phaser.GameObjects.Container,
): Cell | null {
  const size = grid.length;
  const cellSize = gridContainer.width / size;

  const localX = x - gridContainer.x;
  const localY = y - gridContainer.y;

  const col = Math.floor(localX / cellSize);
  const row = Math.floor(localY / cellSize);

  if (row < 0 || row >= size || col < 0 || col >= size) return null;
  return grid[row][col];
}

export function getGridCellCoords(
  row: number,
  col: number,
  gridContainer: Phaser.GameObjects.Container,
): { x: number; y: number } {
  const size = gridContainer.width / (gridContainer as unknown as { _gridSize: number })._gridSize;
  return {
    x: gridContainer.x + col * size + size / 2,
    y: gridContainer.y + row * size + size / 2,
  };
}

export function renderGrid(
  scene: Phaser.Scene,
  grid: Cell[][],
  container: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const size = grid.length;
  const cellSize = container.width / size;
  const gap = 2;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = grid[r][c];
      const x = c * cellSize + cellSize / 2;
      const y = r * cellSize + cellSize / 2;

      if (!cell.isActive) {
        continue;
      }

      const bg = scene.add.rectangle(
        x, y,
        cellSize - gap, cellSize - gap,
        0x16213e,
      );
      bg.setStrokeStyle(1, 0x0f3460);
      container.add(bg);

      switch (cell.type) {
        case 'dot':
          if (cell.dotColor) {
            const dot = scene.add.circle(x, y, cellSize * 0.3, Phaser.Display.Color.HexStringToColor(COLOR_HEX[cell.dotColor]).color);
            container.add(dot);
          }
          break;

        case 'wall':
          const wall = scene.add.rectangle(x, y, cellSize - gap, cellSize - gap, 0x333333);
          container.add(wall);
          break;

        case 'mixer':
          const mixer = scene.add.circle(x, y, cellSize * 0.35, 0x888888);
          container.add(mixer);
          break;

        case 'teleport':
          const tp = scene.add.circle(x, y, cellSize * 0.3, 0x9b59b6);
          container.add(tp);
          const tpLabel = scene.add.text(x, y, cell.teleportId ?? '?', {
            fontSize: `${cellSize * 0.3}px`,
            color: '#ffffff',
            fontFamily: 'Arial',
          }).setOrigin(0.5);
          container.add(tpLabel);
          break;

        case 'lock':
          const lock = scene.add.rectangle(x, y, cellSize - gap, cellSize - gap, 0x555555);
          container.add(lock);
          const lockIcon = scene.add.text(x, y, '🔒', {
            fontSize: `${cellSize * 0.35}px`,
          }).setOrigin(0.5);
          container.add(lockIcon);
          break;
      }
    }
  }

  (container as unknown as { _gridSize: number })._gridSize = size;

  return container;
}
