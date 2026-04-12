import Phaser from 'phaser';
import type { Cell, GamePath, LevelData } from '../types';
import { createEmptyGrid, populateGridFromLevel, getCellAtPixel, renderGrid } from '../game/Grid';
import { canExtendPath, addCellToPath, shrinkPath, resetPath, isPathComplete, createGamePath, cutPathAtPoint } from '../game/Path';
import { checkWin } from '../game/WinChecker';
import { COLOR_HEX } from '../config.ts';

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private grid!: Cell[][];
  private paths!: GamePath[];
  private gridContainer!: Phaser.GameObjects.Container;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private activePath: GamePath | null = null;
  private isDrawing = false;
  private cellSize = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { level: LevelData }): void {
    this.level = data.level;
    this.grid = createEmptyGrid(this.level.gridSize, this.level.shapeMask);
    populateGridFromLevel(this.grid, this.level);
    this.paths = this.level.pairs.map(p => {
      const startCell = this.grid[p.start[0]][p.start[1]];
      return createGamePath(p.color, startCell);
    });
    this.activePath = null;
    this.isDrawing = false;
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const gridSize = this.level.gridSize;

    const maxGridPixel = Math.min(width, height) * 0.85;
    this.cellSize = Math.floor(maxGridPixel / gridSize);
    const gridPixelSize = this.cellSize * gridSize;

    this.gridContainer = this.add.container(width / 2 - gridPixelSize / 2, height / 2 - gridPixelSize / 2);
    this.gridContainer.setSize(gridPixelSize, gridPixelSize);

    renderGrid(this, this.grid, this.gridContainer);

    this.pathGraphics = this.add.graphics();
    this.pathGraphics.setDepth(10);

    this.drawAllPaths();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    this.drawHUD();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const cell = getCellAtPixel(this.grid, pointer.x, pointer.y, this.gridContainer);
    if (!cell || !cell.isActive) return;

    if (cell.type === 'dot' && cell.dotColor) {
      const existingPath = this.paths.find(p => p.color === cell.dotColor);
      if (existingPath) {
        if (existingPath.isComplete) {
          resetPath(existingPath, this.grid);
          this.drawAllPaths();
        }
        this.activePath = existingPath;
        this.isDrawing = true;
      }
    } else if (cell.isFilled && cell.pathColor) {
      const existingPath = this.paths.find(p => p.color === cell.pathColor);
      if (existingPath) {
        const cellIndex = existingPath.cells.findIndex(([r, c]) => r === cell.row && c === cell.col);
        if (cellIndex > 0 && cellIndex < existingPath.cells.length - 1) {
          cutPathAtPoint(existingPath, cellIndex, this.grid);
          this.drawAllPaths();
        }
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDrawing || !this.activePath) return;

    const cell = getCellAtPixel(this.grid, pointer.x, pointer.y, this.gridContainer);
    if (!cell || !cell.isActive) return;

    const [lastR, lastC] = this.activePath.cells[this.activePath.cells.length - 1];

    if (cell.row === lastR && cell.col === lastC) return;

    const prevIndex = this.activePath.cells.findIndex(([r, c]) => r === cell.row && c === cell.col);
    if (prevIndex >= 0) {
      if (prevIndex === this.activePath.cells.length - 2) {
        shrinkPath(this.activePath, this.grid);
        this.drawAllPaths();
      }
      return;
    }

    if (!canExtendPath(this.activePath, cell)) return;

    addCellToPath(this.activePath, cell, this.grid);

    const pair = this.level.pairs.find(p => p.color === this.activePath!.color);
    if (pair && isPathComplete(this.activePath, pair.end)) {
      this.activePath.isComplete = true;
    }

    this.drawAllPaths();
  }

  private onPointerUp(): void {
    this.isDrawing = false;
    this.activePath = null;

    if (checkWin(this.grid, this.paths, this.level)) {
      this.time.delayedCall(300, () => {
        console.log('Level complete!', this.level.id);
      });
    }
  }

  private drawAllPaths(): void {
    this.pathGraphics.clear();

    for (const path of this.paths) {
      if (path.cells.length < 2) continue;

      const colorHex = COLOR_HEX[path.color];
      const color = Phaser.Display.Color.HexStringToColor(colorHex);

      this.pathGraphics.lineStyle(this.cellSize * 0.4, color.color, 1);

      for (let i = 0; i < path.cells.length - 1; i++) {
        const [r1, c1] = path.cells[i];
        const [r2, c2] = path.cells[i + 1];

        const x1 = this.gridContainer.x - this.gridContainer.width / 2 + c1 * this.cellSize + this.cellSize / 2;
        const y1 = this.gridContainer.y - this.gridContainer.height / 2 + r1 * this.cellSize + this.cellSize / 2;
        const x2 = this.gridContainer.x - this.gridContainer.width / 2 + c2 * this.cellSize + this.cellSize / 2;
        const y2 = this.gridContainer.y - this.gridContainer.height / 2 + r2 * this.cellSize + this.cellSize / 2;

        this.pathGraphics.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  private drawHUD(): void {
    const { width } = this.cameras.main;

    const completed = this.paths.filter(p => p.isComplete).length;
    const total = this.paths.length;

    this.add.text(width / 2, 60, `${completed}/${total}`, {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);
  }
}
