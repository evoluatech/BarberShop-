'use client';

import Image from 'next/image';
import {useState} from 'react';
import {Scissors} from 'lucide-react';
import {BARBERSHOP_INFO} from '@/lib/data/seed';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'md',
  showWordmark = false,
  className = '',
}: BrandLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const dimensions = {
    sm: 'h-8 w-8 sm:h-9 sm:w-9 rounded-lg',
    md: 'h-11 w-11 rounded-xl',
    lg: 'h-16 w-16 rounded-2xl',
    xl: 'h-28 w-28 rounded-2xl',
  }[size];

  const imageSizes = {
    sm: '48px',
    md: '64px',
    lg: '96px',
    xl: '140px',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-3 shrink-0 ${className}`}>
      <div
        className={`relative ${dimensions} overflow-hidden bg-[#141414] border border-[#2B2B2B] flex items-center justify-center shrink-0`}
      >
        {!imgFailed ? (
          <Image
            src={BARBERSHOP_INFO.logoUrl}
            alt={BARBERSHOP_INFO.name}
            fill
            sizes={imageSizes}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="object-cover object-center scale-[1.35]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1C1C1C] to-[#111111] text-[#F7931E]">
            <Scissors className="h-5 w-5" />
          </div>
        )}
      </div>

      {showWordmark && (
        <span className="font-display text-sm sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Barber <span className="text-[#F7931E]">Shop</span>
        </span>
      )}
    </div>
  );
}
