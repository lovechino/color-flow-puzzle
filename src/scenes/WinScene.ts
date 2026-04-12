import Phaser from 'phaser';

export class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  init(data: { levelId: string; moves: number; hintsUsed: number; timeMs: number }): void {
    this.moves = data.moves;
    this.hintsUsed = data.hintsUsed;
    this.timeMs = data.timeMs;
  }

  private moves!: number;
  private hintsUsed!: number;
  private timeMs!: number;

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e).setOrigin(0);

    this.add.text(width / 2, height * 0.25, 'Level Complete!', {
      fontSize: '56px',
      color: '#2ecc71',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const seconds = Math.round(this.timeMs / 1000);
    const stats = [
      { label: 'Moves', value: `${this.moves}` },
      { label: 'Hints Used', value: `${this.hintsUsed}` },
      { label: 'Time', value: `${seconds}s` },
    ];

    stats.forEach((stat, i) => {
      const y = height * 0.4 + i * 70;
      this.add.text(width / 2, y, stat.label, {
        fontSize: '28px',
        color: '#8888cc',
        fontFamily: 'Arial',
      }).setOrigin(0.5);

      this.add.text(width / 2, y + 35, stat.value, {
        fontSize: '36px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0.5);
    });

    const nextY = height * 0.75;

    const nextBtn = this.add.text(width / 2, nextY, 'Next Level →', {
      fontSize: '36px',
      color: '#2ecc71',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    nextBtn.on('pointerdown', () => {
      this.scene.start('GridSelectScene');
    });
    nextBtn.on('pointerover', () => nextBtn.setScale(1.1));
    nextBtn.on('pointerout', () => nextBtn.setScale(1));

    const menuBtn = this.add.text(width / 2, nextY + 70, 'Main Menu', {
      fontSize: '28px',
      color: '#8888cc',
      fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    menuBtn.on('pointerover', () => menuBtn.setScale(1.1));
    menuBtn.on('pointerout', () => menuBtn.setScale(1));
  }
}
