import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col border-l border-brand-border"
          >
            <div className="flex items-center justify-between h-20 px-10 border-b border-brand-border">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-brand-primary">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 border border-brand-primary/10 rounded-full hover:bg-brand-primary hover:text-white transition-all text-brand-primary/50"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
