/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XCircle, Info, CheckCircle2, X } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'error', 
  isVisible, 
  onClose, 
  duration = 5000 
}) => {
  useEffect(() => {
    if (isVisible && duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const icons = {
    error: <XCircle size={18} className="text-red-500" />,
    success: <CheckCircle2 size={18} className="text-green-500" />,
    info: <Info size={18} className="text-brand-primary" />
  };

  const bgColors = {
    error: 'bg-red-50 border-red-100',
    success: 'bg-green-50 border-green-100',
    info: 'bg-white border-brand-border'
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm"
        >
          <div className={`mx-4 p-4 ${bgColors[type]} border shadow-xl flex items-center gap-4`}>
            <div className="shrink-0">{icons[type]}</div>
            <p className="flex-1 text-[10px] uppercase tracking-widest font-bold text-brand-primary leading-tight">
              {message}
            </p>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-brand-bg/50 transition-colors opacity-40 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
