import React from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, User, Edit3, Palette } from "lucide-react";

interface NavbarProps {
  currentTheme: "nebula" | "emerald" | "amber";
  onChangeTheme: (theme: "nebula" | "emerald" | "amber") => void;
  socketConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTheme,
  onChangeTheme,
  socketConnected,
}) => {
  const { user, logout } = useAuth();

  return (
    <nav className="glass-effect border-b border-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md relative z-20">
      
      {/* Brand title */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-blue-500 to-purple-600 p-2.5 rounded-xl text-white shadow-lg animate-pulse">
          <Edit3 className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-black tracking-tight text-white leading-none">
            Collaborative Notes <span className="text-gradient">Studio</span>
          </span>
          <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? "bg-green-500" : "bg-red-500"} inline-block`}></span>
            {socketConnected ? "Sync Engine: Online" : "Sync Engine: Disconnected"}
          </span>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-6">
          
          {/* Theme customizer nodes */}
          <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
            <Palette className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex gap-1.5">
              <button
                onClick={() => onChangeTheme("nebula")}
                className={`w-3.5 h-3.5 rounded-full bg-blue-500 ring-offset-2 ring-offset-slate-950 transition active:scale-75 ${
                  currentTheme === "nebula" ? "ring-2 ring-blue-400" : "opacity-40 hover:opacity-80"
                }`}
                title="Nebula theme"
              />
              <button
                onClick={() => onChangeTheme("emerald")}
                className={`w-3.5 h-3.5 rounded-full bg-emerald-500 ring-offset-2 ring-offset-slate-950 transition active:scale-75 ${
                  currentTheme === "emerald" ? "ring-2 ring-emerald-400" : "opacity-40 hover:opacity-80"
                }`}
                title="Emerald theme"
              />
              <button
                onClick={() => onChangeTheme("amber")}
                className={`w-3.5 h-3.5 rounded-full bg-amber-500 ring-offset-2 ring-offset-slate-950 transition active:scale-75 ${
                  currentTheme === "amber" ? "ring-2 ring-amber-400" : "opacity-40 hover:opacity-80"
                }`}
                title="Amber theme"
              />
            </div>
          </div>

          {/* User badge */}
          <div className="flex items-center gap-2 bg-slate-800/40 px-3.5 py-1.5 rounded-full border border-slate-700/30">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 text-sm font-semibold">
              {user.username}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-500 hover:text-red-400 text-xs font-bold uppercase tracking-wider transition duration-150 py-1.5 px-3 rounded-xl hover:bg-red-500/5 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      )}
    </nav>
  );
};
