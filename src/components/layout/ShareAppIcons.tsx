import React from 'react';
import { FolderOpen, LockKeyhole, Send, Smartphone } from 'lucide-react';

export const PrivateShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[22%] border border-white/40 bg-[linear-gradient(145deg,#59d8c5,#157bb7)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_18px_rgba(10,90,125,.28)] ${className ?? ''}`}
    aria-hidden="true"
  >
    <Send className="-translate-x-0.5 translate-y-0.5" size="58%" strokeWidth={1.8} fill="rgba(255,255,255,.18)" />
    <span className="absolute bottom-[15%] right-[13%] flex h-[31%] w-[31%] items-center justify-center rounded-full border border-white/75 bg-[#0b5f78] shadow-sm">
      <LockKeyhole size="60%" strokeWidth={2.4} />
    </span>
  </span>
);

export const LanShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[22%] border border-white/45 bg-[linear-gradient(145deg,#66d7b0,#177b62)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_18px_rgba(9,92,66,.28)] ${className ?? ''}`}
    aria-hidden="true"
  >
    <FolderOpen size="62%" strokeWidth={1.8} fill="rgba(255,255,255,.15)" />
    <span className="absolute bottom-[12%] right-[11%] flex h-[34%] w-[34%] items-center justify-center rounded-full border border-white/75 bg-[#0c5d4b] shadow-sm">
      <Smartphone size="58%" strokeWidth={2.2} />
    </span>
  </span>
);

