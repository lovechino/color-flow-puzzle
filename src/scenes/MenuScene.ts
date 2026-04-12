import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e).setOrigin(0);

    this.add.text(width / 2, height / 3, 'Color Flow', {
      fontSize: '72px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, 'Puzzle', {
      fontSize: '48px',
      color: '#8888cc',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    const playBtn = this.add.text(width / 2, height * 0.65, '▶  PLAY', {
      fontSize: '42px',
      color: '#2ecc71',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerdown', () => {
      this.scene.start('GridSelectScene');
    });

    playBtn.on('pointerover', () => playBtn.setScale(1.1));
    playBtn.on('pointerout', () => playBtn.setScale(1));
  }
}
