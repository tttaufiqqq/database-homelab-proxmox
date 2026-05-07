/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signUp, isLoading } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      showToast('Please fill in all fields to proceed', 'error');
      return;
    }

    try {
      if (mode === 'signin') {
        await signIn(email);
        showToast(`Welcome back, ${email.split('@')[0]}!`, 'success');
      } else {
        await signUp(email);
        showToast('Account created successfully!', 'success');
      }
      onClose();
    } catch (err) {
      showToast('Authentication failed. Please verify your credentials.', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white p-8 md:p-12 shadow-2xl border border-brand-border"
          >
            <button
              onClick={onClose}
              className="absolute right-6 top-6 text-brand-primary/40 hover:text-brand-primary transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-10 text-center">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-primary/40 mb-2 block">
                {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </span>
              <h2 className="text-3xl font-light tracking-tight text-brand-primary uppercase">
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-primary/60">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-brand-bg/50 border border-brand-border p-4 text-xs uppercase tracking-widest outline-none focus:border-brand-primary transition-colors"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-primary/60">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-brand-bg/50 border border-brand-border p-4 text-xs uppercase tracking-widest outline-none focus:border-brand-primary transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                fullWidth
                size="md"
                className="mt-4"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                {!isLoading && <ArrowRight size={16} className="ml-2" />}
              </Button>
            </form>

            <div className="mt-10 pt-10 border-t border-brand-border text-center">
              <p className="text-[10px] uppercase tracking-widest text-brand-primary/40 mb-4 font-medium">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
              </p>
              <button
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-[10px] uppercase tracking-widest font-bold text-brand-primary hover:tracking-[0.2em] transition-all"
              >
                {mode === 'signin' ? 'Sign Up for Free' : 'Sign In Now'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
