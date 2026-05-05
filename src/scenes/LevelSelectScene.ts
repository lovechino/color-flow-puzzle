import Phaser from 'phaser';
import { LEVEL_COUNTS_BY_GRID } from '../config.ts';
import { getCompletedLevels } from '../storage/GameStorage';

export class LevelSelectScene extends Phaser.Scene {
  private gridSize!: number;

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data: { gridSize: number }): void {
    this.gridSize = data.gridSize;
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const completed = getCompletedLevels();
    const totalLevels = LEVEL_COUNTS_BY_GRID[this.gridSize] ?? 0;

    this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e).setOrigin(0);

    this.add.text(width / 2, 80, `${this.gridSize}×${this.gridSize}`, {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const cols = 5;
    const startX = width * 0.15;
    const startY = 180;
    const spacingX = width * 0.18;
    const spacingY = 70;

    for (let i = 0; i < totalLevels; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;

      const levelNum = i + 1;
      const levelId = `g${String(this.gridSize).padStart(2, '0')}_${String(levelNum).padStart(3, '0')}`;
      const isCompleted = completed.has(levelId);

      const btn = this.add.rectangle(x, y, 60, 50, isCompleted ? 0x2ecc71 : 0x0f3460);
      btn.setInteractive({ useHandCursor: true });

      this.add.text(x, y, `${levelNum}`, {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      if (isCompleted) {
        this.add.text(x, y + 20, '★', {
          fontSize: '16px',
          color: '#f1c40f',
        }).setOrigin(0.5);
      }

      btn.on('pointerdown', () => {
        this.startDemoLevel(levelId);
      });
      btn.on('pointerover', () => btn.setFillStyle(0x1a4a7a));
      btn.on('pointerout', () => btn.setFillStyle(isCompleted ? 0x2ecc71 : 0x0f3460));
    }

    this.addBackButton(width, height);
  }

  private async startDemoLevel(levelId: string): Promise<void> {
    try {
      const gridSize = this.gridSize;
      const gridKey = `grid_${String(gridSize).padStart(2, '0')}`;
      
      // Dynamic import for level data
      const levelModule = await import(`../levels/${gridKey}/${levelId}.json`);
      const level = levelModule.default || levelModule;
      
      this.scene.start('GameScene', { level });
    } catch {
      console.warn(`Level ${levelId} not found, using fallback`);
      // Fallback: still start GameScene with minimal data
      const fallbackLevel = {
        id: levelId,
        gridSize: this.gridSize,
        pairs: [],
        walls: [],
        mixers: [],
        teleports: [],
        locks: [],
        solution: [],
        difficultyScore: 0,
        difficultyLabel: 'trivial' as const,
        par: 0,
        estimatedSolveTime: 0,
        mechanics: [],
      };
      this.scene.start('GameScene', { level: fallbackLevel });
    }
  }

  private addBackButton(width: number, height: number): void {
    const backBtn = this.add.text(width / 2, height - 80, '← Back', {
      fontSize: '32px',
      color: '#8888cc',
      fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.scene.start('GridSelectScene'));
    backBtn.on('pointerover', () => backBtn.setScale(1.1));
    backBtn.on('pointerout', () => backBtn.setScale(1));
  }
}
