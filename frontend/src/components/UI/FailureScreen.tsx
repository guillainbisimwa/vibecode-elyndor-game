import React from 'react';
import { useGameStore } from '../../store/gameStore';

const FailureScreen: React.FC = () => {
  const { character, setScreen } = useGameStore();

  const handleRespawn = () => {
    // Respawn in town with refilled HP
    if (character) {
      character.health = character.max_health;
      useGameStore.setState({ character });
    }
    setScreen('DASHBOARD');
  };

  return (
    <div className="glass-panel max-w-md w-full p-8 rounded-lg relative overflow-hidden flex flex-col items-center border-elyndor-blood/40 shadow-blood-glow">
      {/* Red ambient bleed overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-elyndor-blood/10 to-transparent opacity-30" />

      <span className="text-5xl mb-4 animate-pulse">💀</span>
      
      <h1 className="font-cinzel text-3xl font-black text-center text-red-500 mb-1 tracking-wider uppercase">
        Fallen in Battle
      </h1>
      <h2 className="font-cinzel text-[10px] font-bold tracking-widest text-zinc-500 mb-6 text-center uppercase">
        Your Journey has been Halted
      </h2>

      <div className="w-full bg-[#07080d] border border-elyndor-blood/15 p-5 rounded-md flex flex-col gap-2.5 text-xs font-mono mb-6 leading-relaxed text-[#a3a5be]">
        <p className="font-cinzel text-[10px] text-red-400 font-bold uppercase tracking-widest border-b border-elyndor-blood/10 pb-1.5 mb-1">
          Combat Demise Record
        </p>
        <p>
          <span className="text-zinc-600 uppercase">Demise Location:</span> {character?.current_region} Sanctuary Depth.
        </p>
        <p>
          <span className="text-zinc-600 uppercase">Demise Reason:</span> Hit point threshold depleted to 0 HP.
        </p>
        <p className="text-[10px] italic border-t border-elyndor-ash/40 pt-2 mt-1 text-zinc-500">
          "The void does not pity heroes. Recover your strength and sharpen your steel before stepping out again."
        </p>
      </div>

      <button
        onClick={handleRespawn}
        className="w-full p-3.5 rounded btn-gold"
      >
        Respawn in Regional Town
      </button>
    </div>
  );
};

export default FailureScreen;
