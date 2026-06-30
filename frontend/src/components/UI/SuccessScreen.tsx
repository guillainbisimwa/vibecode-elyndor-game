import React from 'react';
import { useGameStore } from '../../store/gameStore';

const SuccessScreen: React.FC = () => {
  const { combatRewards, character, setScreen } = useGameStore();

  const handleReturn = () => {
    // Re-fill health in safe zone
    if (character) {
      character.health = character.max_health;
      useGameStore.setState({ character });
    }
    // Return to Dashboard Screen
    setScreen('DASHBOARD');
  };

  return (
    <div className="glass-panel max-w-md w-full p-8 rounded-lg relative overflow-hidden flex flex-col items-center border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
      {/* Decorative background flare */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-emerald-950/10 to-transparent opacity-30" />

      <span className="text-5xl mb-4 animate-bounce">🏆</span>
      
      <h1 className="font-cinzel text-3xl font-black text-center text-emerald-400 mb-1 tracking-wider uppercase">
        Threat Cleared
      </h1>
      <h2 className="font-cinzel text-[10px] font-bold tracking-widest text-[#a3a5be] mb-6 text-center uppercase">
        Loot & Spoils Secured
      </h2>

      {/* Rewards details */}
      <div className="w-full bg-[#07080d] border border-emerald-500/10 p-5 rounded-md flex flex-col gap-3 text-sm font-mono mb-6">
        <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest border-b border-elyndor-ash/40 pb-2 mb-1">
          Victory Spoils
        </h3>
        <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5">
          <span className="text-zinc-500">🪙 GOLD BALANCE</span>
          <span className="text-yellow-400 font-bold">+{combatRewards?.gold || 30} G</span>
        </div>
        <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5">
          <span className="text-zinc-500">✨ COGNITIVE XP</span>
          <span className="text-emerald-400 font-bold">+{combatRewards?.xp || 80} XP</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">❤️ VITALITY HP STATUS</span>
          <span className="text-red-400 font-bold">{character?.health} HP (Refilled in town)</span>
        </div>
      </div>

      <p className="text-xs text-[#a3a5be] text-center leading-relaxed mb-6">
        The dark threat has retreated, cleansing Elyndor's local pathways. Travel back to the regional sanctuary to recover.
      </p>

      <button
        onClick={handleReturn}
        className="w-full p-3.5 rounded btn-gold"
      >
        Collect Loot & Return
      </button>
    </div>
  );
};

export default SuccessScreen;
