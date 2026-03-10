'use client';

import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';

export default function FarmerComingSoon() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-[900]"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center p-8 rounded-2xl"
        style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.12)', maxWidth: 340 }}
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', damping: 20 }}
      >
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Sprout size={26} className="text-green-400" />
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Farmer Dashboard</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Farmer monitoring module is currently being set up. It will include crop water usage, soil
          moisture alerts, and irrigation scheduling.
        </p>
        <div className="mt-4 px-4 py-2 rounded-lg inline-block"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <span className="text-xs text-green-400 font-medium">Coming Soon</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
