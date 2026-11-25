'use client';

import {AnimatePresence, motion} from 'motion/react';
import {useEffect, useState} from 'react';
import {BrandLogo} from '@/components/BrandLogo';
import {BARBERSHOP_INFO} from '@/lib/data/seed';

const SPLASH_SESSION_KEY = 'bs_splash_seen';

export function SplashOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
      if (!alreadySeen) {
        window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
      }
    } catch {
      // Ignore storage failures
    }
    const timer = window.setTimeout(
      () => {
        setVisible(false);
      },
      alreadySeen ? 0 : 450
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.25, ease: [0.16, 1, 0.3, 1]}}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#111111] px-6 text-center"
          role="dialog"
          aria-label="Tela de abertura Barber Shop"
        >
          <motion.div
            initial={{opacity: 0, scale: 0.96}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.25, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-col items-center"
          >
            <BrandLogo size="xl" priority />
            <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {BARBERSHOP_INFO.name}
            </h1>
            <p className="mt-2 text-sm text-[#E5E5E5]/70">{BARBERSHOP_INFO.tagline}</p>

            <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-[#2B2B2B]">
              <motion.div
                initial={{x: '-100%'}}
                animate={{x: '0%'}}
                transition={{duration: 0.4, ease: [0.16, 1, 0.3, 1]}}
                className="h-full w-full bg-[#F7931E]"
              />
            </div>
          </motion.div>

          <button
            type="button"
            onClick={() => setVisible(false)}
            className="mt-10 min-h-[44px] px-4 text-xs font-medium text-[#E5E5E5]/60 hover:text-white transition-colors"
          >
            Entrar agora
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
