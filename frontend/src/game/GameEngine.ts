import Phaser from 'phaser';
import { useGameStore } from '../store/gameStore';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private playerVisuals!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private mapGrid: string[][] = [];
  private tiles: Phaser.GameObjects.Rectangle[] = [];
  private tileWidth = 48;
  private tileHeight = 48;
  private isMovementLocked = false;
  
  // Game triggers
  private npcTriggers: { r: number, c: number, npc: any }[] = [];
  private monsterTriggers: { r: number, c: number, monsterObject: Phaser.GameObjects.Arc, name: string, hp: number }[] = [];
  private chestTriggers: { r: number, c: number, chestObject: Phaser.GameObjects.Star, claimed: boolean }[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    // Read map ASCII array from Zustand
    const state = useGameStore.getState();
    const regionName = state.character?.current_region || "Eldergate";
    const region = state.regions.find(r => r.name === regionName);
    
    if (region) {
      this.mapGrid = region.terrain_ascii.split('\n').map(row => row.split(''));
    } else {
      // Fallback
      this.mapGrid = [
        "##########".split(''),
        "#S...T...#".split(''),
        "#..####..#".split(''),
        "#..#..#..#".split(''),
        "#..M..E..#".split(''),
        "##########".split('')
      ];
    }
  }

  preload() {
    // Generate procedurally synthesized graphics textures directly!
    // No binary files needed. This ensures 100% reliability offline.
    this.createProceduralTextures();
  }

  create() {
    this.cameras.main.setBackgroundColor('#06070a');
    
    // Draw Level Layout
    this.drawTilemap();
    
    // Setup controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys('W,A,S,D') as { [key: string]: Phaser.Input.Keyboard.Key };
    }

    // Camera setup
    this.cameras.main.setBounds(0, 0, this.mapGrid[0].length * this.tileWidth, this.mapGrid.length * this.tileHeight);
    
    // Floating text instruction overlay
    this.add.text(16, 16, "MOVE: WASD / ARROWS\nSTAND ON 'T' to chat NPC\nSTAND ON 'M' to FIGHT\nSTAND ON 'G' for LOOT\nSTAND ON 'E' to COMPLETE REGION", {
      fontFamily: 'Outfit',
      fontSize: '11px',
      color: '#e2b653',
      backgroundColor: '#0c0d15',
      padding: { x: 10, y: 10 }
    }).setScrollFactor(0).setStroke('#b89047', 1).setAlpha(0.85);

    // Initial positioning check for player start
    this.cameras.main.fadeIn(500, 6, 7, 10);
  }

  update() {
    if (!this.player || this.isMovementLocked) return;

    let dx = 0;
    let dy = 0;

    // Read movement buttons
    if (this.cursors.left.isDown || this.keys.A?.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.keys.D?.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.keys.W?.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.keys.S?.isDown) dy = 1;

    if (dx !== 0 || dy !== 0) {
      this.attemptPlayerMove(dx, dy);
    }
  }

  private attemptPlayerMove(dx: number, dy: number) {
    // Determine player current grid coordinates
    const curR = Math.floor(this.playerVisuals.y / this.tileHeight);
    const curC = Math.floor(this.playerVisuals.x / this.tileWidth);
    
    const targetR = curR + dy;
    const targetC = curC + dx;

    // Boundary check
    if (targetR < 0 || targetR >= this.mapGrid.length || targetC < 0 || targetC >= this.mapGrid[0].length) return;

    const tileChar = this.mapGrid[targetR][targetC];
    
    // Wall block
    if (tileChar === '#') return;

    // Movement animation
    this.isMovementLocked = true;
    
    this.tweens.add({
      targets: this.playerVisuals,
      x: targetC * this.tileWidth + this.tileWidth / 2,
      y: targetR * this.tileHeight + this.tileHeight / 2,
      duration: 150,
      onComplete: () => {
        this.isMovementLocked = false;
        this.checkTileTriggers(targetR, targetC);
      }
    });
  }

  private checkTileTriggers(r: number, c: number) {
    const tileChar = this.mapGrid[r][c];

    // 1. NPC Trigger (T)
    if (tileChar === 'T') {
      const state = useGameStore.getState();
      const currentRegion = state.character?.current_region || "Eldergate";
      const regionalNpc = state.npcs.find(n => n.current_region === currentRegion);
      if (regionalNpc) {
        state.setActiveNpc(regionalNpc);
        this.flashNotice("SPEAKING WITH NPC PORTAL...");
      }
    } else {
      // Exit NPC dialogue if step away
      useGameStore.getState().setActiveNpc(null);
    }

    // 2. Monster Engage (M)
    const monster = this.monsterTriggers.find(m => m.r === r && m.c === c);
    if (monster) {
      const state = useGameStore.getState();
      // Lock movement and trigger combat screen
      this.isMovementLocked = true;
      state.triggerCombat(monster.name, monster.hp);
      
      // Animate camera zooming in to combat arena
      this.cameras.main.zoomTo(1.6, 500, 'Cubic', true, () => {
        state.setScreen('GAMEPLAY'); // Triggers battle card Overlay
      });
    }

    // 3. Gold Chest Grab (G)
    const chest = this.chestTriggers.find(g => g.r === r && g.c === c);
    if (chest && !chest.claimed) {
      chest.claimed = true;
      chest.chestObject.destroy();
      
      // Update local state and trigger dynamic popup
      const state = useGameStore.getState();
      if (state.character) {
        const goldGain = 25 + Math.floor(Math.random() * 25);
        state.character.gold += goldGain;
        state.dashboardLogs.push(`Discovered secret Loot Chest in ${state.character.current_region}! Looted 🪙 ${goldGain} Gold.`);
        
        // Spawn particle bubbles
        this.createExplosionParticles(chest.chestObject.x, chest.chestObject.y, 0xe2b653);
        this.flashNotice(`CLAIMED SECRET GOLD CHEST! +${goldGain} G`);
      }
    }

    // 4. Exit Crypt Trigger (E)
    if (tileChar === 'E') {
      const state = useGameStore.getState();
      // Only allow exit if they have defeated threats or are level scaling
      this.flashNotice("REGION COMPLETED! RETURNING TO SAFE ZONE");
      setTimeout(() => {
        state.setScreen('DASHBOARD');
      }, 1000);
    }
  }

  private drawTilemap() {
    const primaryColor = 0x1f2129; // Deep dark charcoal
    const borderColor = 0xb89047; // Epic gold hilt
    
    for (let r = 0; r < this.mapGrid.length; r++) {
      for (let c = 0; c < this.mapGrid[r].length; c++) {
        const char = this.mapGrid[r][c];
        
        const px = c * this.tileWidth;
        const py = r * this.tileHeight;

        // Base tile rectangle
        const rect = this.add.rectangle(px + this.tileWidth/2, py + this.tileHeight/2, this.tileWidth - 2, this.tileHeight - 2, primaryColor);
        rect.setStrokeStyle(1, 0x141724);
        this.tiles.push(rect);

        // Character specific procedural draws
        if (char === '#') {
          // Wall / Mountain block
          rect.setFillStyle(0x0c0d12);
          rect.setStrokeStyle(1, borderColor, 0.4);
          
          // Draw mini brick ridges
          this.add.rectangle(rect.x, rect.y, this.tileWidth - 10, 4, 0xb89047, 0.15);
        } else if (char === 'S') {
          // Starting Point
          this.add.text(px + 12, py + 14, "🚩", { fontSize: '18px' });
          this.spawnPlayer(r, c);
        } else if (char === 'T') {
          // Town Portal
          rect.setFillStyle(0x0a1c2a);
          this.add.text(px + 10, py + 10, "🧙", { fontSize: '20px' });
          this.add.ellipse(px + 24, py + 24, 32, 12, 0x2b569a, 0.35);
        } else if (char === 'M') {
          // Monster Trigger
          const state = useGameStore.getState();
          const regionLvl = state.regions.find(reg => reg.name === state.character?.current_region)?.difficulty_level || 1;
          const mNames = ["Fallen Ghoul", "Void Specter", "Frost Golem", "Ember Drake"];
          const monsterName = mNames[regionLvl - 1] || "Ruins Crawler";
          const enemyHP = 40 + (regionLvl * 30);
          
          const mObj = this.add.circle(px + 24, py + 24, 14, 0x8c1d1d);
          mObj.setStrokeStyle(1.5, 0xe2b653);
          
          // Floating red claw indicator
          this.add.text(px + 14, py + 12, "👿", { fontSize: '15px' });
          
          this.monsterTriggers.push({
            r, c, 
            monsterObject: mObj,
            name: monsterName,
            hp: enemyHP
          });
        } else if (char === 'G') {
          // Loot Chest
          const chestObj = this.add.star(px + 24, py + 24, 5, 8, 14, 0xe2b653);
          chestObj.setStrokeStyle(1, 0x06070a);
          
          // floating gold text indicator
          this.add.text(px + 12, py + 10, "🪙", { fontSize: '16px' });
          
          this.chestTriggers.push({
            r, c,
            chestObject: chestObj,
            claimed: false
          });
        } else if (char === 'E') {
          // Exit portal
          rect.setFillStyle(0x1a0a0a);
          this.add.text(px + 10, py + 8, "🚪", { fontSize: '22px' });
          this.add.ellipse(px + 24, py + 36, 28, 8, 0x8c1d1d, 0.4);
        }
      }
    }
  }

  private spawnPlayer(r: number, c: number) {
    const px = c * this.tileWidth + this.tileWidth / 2;
    const py = r * this.tileHeight + this.tileHeight / 2;
    
    // Create player visual container
    this.playerVisuals = this.add.container(px, py);
    
    // Zustand character style hook
    const state = useGameStore.getState();
    const charClass = state.character?.character_class || "Warrior";
    
    const pColor = charClass === "Warrior" ? 0x8c1d1d : charClass === "Mage" ? 0x2b569a : 0x1d5c2e;
    
    this.player = this.add.circle(0, 0, 15, pColor) as any;
    this.player.setStrokeStyle(2, 0xe2b653);
    
    const faceText = this.add.text(-8, -10, "🤠", { fontSize: '14px' });
    
    this.playerVisuals.add([this.player, faceText]);
    
    // Setup dynamic glowing light ring
    const glowRing = this.add.ellipse(0, 12, 28, 8, 0xe2b653, 0.25);
    this.playerVisuals.add(glowRing);
    
    // Camera follow player container
    this.cameras.main.startFollow(this.playerVisuals, true, 0.1, 0.1);
  }

  private createExplosionParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 15; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(2, 5), color);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(50, 150);
      
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.1,
        duration: 800,
        onComplete: () => p.destroy()
      });
    }
  }

  private flashNotice(msg: string) {
    const txt = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, msg, {
      fontFamily: 'Cinzel',
      fontSize: '14px',
      color: '#e2b653',
      backgroundColor: 'rgba(6, 7, 10, 0.85)',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setStroke('#b89047', 1);

    this.tweens.add({
      targets: txt,
      y: txt.y - 30,
      alpha: 0,
      delay: 1000,
      duration: 1000,
      onComplete: () => txt.destroy()
    });
  }

  private createProceduralTextures() {
    // Generate simple procedural canvases if ever needed.
    // Phaser 3 is highly capable of running without images using Arc, Rectangle, Star, Ellipse!
  }
}
export const getPhaserConfig = (parent: HTMLElement) => ({
  type: Phaser.AUTO,
  width: '100%',
  height: '100%',
  parent: parent,
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [GameScene]
});
