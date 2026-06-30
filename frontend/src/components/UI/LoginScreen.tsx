import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';

const LoginScreen: React.FC = () => {
  const { login, register, setScreen } = useGameStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        const success = await register(username, password);
        if (success) {
          setIsRegistering(false);
          setError("Account created successfully! Please log in.");
        } else {
          setError("Registration failed. Username may be taken.");
        }
      } else {
        const success = await login(username, password);
        if (success) {
          // Check if user already has a character, if so go to dashboard, else create one
          setScreen('CHARACTER_CREATION');
        } else {
          setError("Invalid credentials. Try again.");
        }
      }
    } catch (err) {
      setError("Server error. Launching in sandbox offline mode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel max-w-md w-full p-8 rounded-lg relative overflow-hidden flex flex-col items-center">
      {/* Ancient rune background emblem */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center select-none text-[20rem] font-serif">
        ⚔️
      </div>

      <h1 className="font-cinzel text-3xl font-black text-center text-elyndor-gold mb-1 tracking-wider">
        VIBECODE
      </h1>
      <h2 className="font-cinzel text-sm font-semibold tracking-widest text-[#8c92ac] mb-8 text-center uppercase">
        Legends of Elyndor
      </h2>

      {error && (
        <div className="w-full text-xs text-center border border-elyndor-blood/40 bg-elyndor-blood/10 text-red-400 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 relative z-10">
        <div>
          <label className="block text-xs font-semibold tracking-wider text-elyndor-gold uppercase mb-1.5 font-cinzel">
            Username
          </label>
          <input
            type="text"
            className="w-full p-3 rounded input-dark"
            placeholder="Enter traveler name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold tracking-wider text-elyndor-gold uppercase mb-1.5 font-cinzel">
            Password
          </label>
          <input
            type="password"
            className="w-full p-3 rounded input-dark"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading} className="w-full p-3.5 rounded btn-gold mt-4">
          {loading ? "Channelling..." : isRegistering ? "Forge Account" : "Enter World"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 items-center text-xs text-[#a3a5be]">
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="text-elyndor-gold hover:underline cursor-pointer"
        >
          {isRegistering ? "Already have an account? Log In" : "First time in Elyndor? Create Account"}
        </button>

        <div className="flex gap-4 items-center mt-4 border-t border-elyndor-ash/40 pt-4 w-full justify-center">
          <span className="text-[10px] text-[#5b5e70] uppercase tracking-widest font-semibold">
            Social Placeholders
          </span>
          <div className="flex gap-2">
            <span className="w-6 h-6 rounded-full bg-elyndor-ash/60 border border-elyndor-border/20 flex items-center justify-center cursor-not-allowed text-[10px]">G</span>
            <span className="w-6 h-6 rounded-full bg-elyndor-ash/60 border border-elyndor-border/20 flex items-center justify-center cursor-not-allowed text-[10px]">D</span>
            <span className="w-6 h-6 rounded-full bg-elyndor-ash/60 border border-elyndor-border/20 flex items-center justify-center cursor-not-allowed text-[10px]">A</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
