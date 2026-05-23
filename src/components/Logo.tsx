/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export default function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <div id="noisecut-logo" className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* SVG Waveform Slicer Icon */}
      <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 shadow-sm overflow-hidden">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5 text-gray-400"
        >
          {/* Signal Waveform back */}
          <path d="M3 12h2l2-6 2 12 2-10 2 8 2-6 2 4h2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Knife Slit overlay (Red/Cyan Slash Concept) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#3B82F6]/20 to-[#10B981]/20 pointer-events-none" />
        <div className="absolute h-[150%] w-[1.5px] bg-[#3B82F6] rotate-[22deg] right-[40%] translate-x-[50%] opacity-90 blur-[0.5px]" />
      </div>
      
      {!iconOnly && (
        <span className="text-sm font-semibold tracking-tight text-white font-sans flex items-center gap-1">
          Noise<span className="text-[#3B82F6] font-medium font-mono">Cut</span>
          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono tracking-wider ml-1">
            v1.0
          </span>
        </span>
      )}
    </div>
  );
}
