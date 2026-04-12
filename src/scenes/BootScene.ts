import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    const bg = this.add.rectangle(0, 0, width * 2, height * 2, 0x1a1a2e);
    bg.setOrigin(0);

    const text = this.add.text(width / 2, height / 2, 'Loading...', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    text.setOrigin(0.5);

    this.load.on('complete', () => {
      this.time.delayedCall(300, () => {
        this.scene.start('MenuScene');
      });
    });
  }
}
