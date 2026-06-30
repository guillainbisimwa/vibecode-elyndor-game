import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getPhaserConfig } from '../../game/GameEngine';

const GameplayCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game|null>(null);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      const config = getPhaserConfig(containerRef.current);
      gameRef.current = new Phaser.Game(config);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded border border-elyndor-border/20 overflow-hidden">
      <div ref={containerRef} className="w-full h-full bg-[#06070a]" />
    </div>
  );
};

export default GameplayCanvas;
