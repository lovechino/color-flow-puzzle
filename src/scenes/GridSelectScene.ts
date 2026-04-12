import Phaser from 'phaser';
import { LEVEL_COUNTS_BY_GRID, UNLOCK_THRESHOLDS } from '../config.ts';
import { loadProfile } from '../storage/GameStorage';

export class GridSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GridSelectScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const profile = loadProfile();

    this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e).setOrigin(0);

    this.add.text(width / 2, 80, 'Select Grid Size', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const gridSizes = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const startY = 160;
    const spacing = 70;
    const cols = 3;

    gridSizes.forEach((size, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = width * 0.25 + col * (width * 0.25);
      const y = startY + row * spacing;

      const unlocked = profile.skillLevel >= (UNLOCK_THRESHOLDS[size] ?? 100);
      const count = LEVEL_COUNTS_BY_GRID[size] ?? 0;

      const bg = this.add.rectangle(x, y, width * 0.2, 50, unlocked ? 0x0f3460 : 0x222222);
      bg.setInteractive({ useHandCursor: unlocked });

      this.add.text(x, y, `${size}×${size}`, {
        fontSize: '28px',
        color: unlocked ? '#ffffff' : '#555555',
        fontFamily: 'Arial',
      }).setOrigin(0.5);

      this.add.text(x, y + 20, unlocked ? `${count} levels` : `Skill ${UNLOCK_THRESHOLDS[size]}+`, {
        fontSize: '16px',
        color: unlocked ? '#8888cc' : '#444444',
        fontFamily: 'Arial',
      }).setOrigin(0.5);

      if (unlocked) {
        bg.on('pointerdown', () => {
          this.scene.start('LevelSelectScene', { gridSize: size });
        });
        bg.on('pointerover', () => bg.setFillStyle(0x1a4a7a));
        bg.on('pointerout', () => bg.setFillStyle(0x0f3460));
      }
    });

    this.addBackButton(width, height);
  }

  private addBackButton(width: number, height: number): void {
    const backBtn = this.add.text(width / 2, height - 80, '← Back', {
      fontSize: '32px',
      color: '#8888cc',
      fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    backBtn.on('pointerover', () => backBtn.setScale(1.1));
    backBtn.on('pointerout', () => backBtn.setScale(1));
  }
}
