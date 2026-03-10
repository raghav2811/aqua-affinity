'use client';

import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';

export default function FarmerComingSoon() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-[900]"
      style={{ background: 'rgba(14,165,233,0.08)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center p-8 rounded-2xl"
        style={{ background: '#ffffff', border: '1px solid #bae6fd', boxShadow: '0 8px 40px rgba(14,165,233,0.15)', maxWidth: 340 }}
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', damping: 20 }}
      >
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(5,150,105,0.10)', border: '1px solid rgba(5,150,105,0.25)' }}>
          <Sprout size={26} style={{ color: '#059669' }} />
        </div>
        <h2 className="font-bold text-lg mb-2" style={{ color: '#0c4a6e' }}>Farmer Dashboard</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
          Farmer monitoring module is currently being set up. It will include crop water usage, soil
          moisture alerts, and irrigation scheduling.
        </p>
        <div className="mt-4 px-4 py-2 rounded-lg inline-block"
          style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
          <span className="text-xs font-medium" style={{ color: '#059669' }}>Coming Soon</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
