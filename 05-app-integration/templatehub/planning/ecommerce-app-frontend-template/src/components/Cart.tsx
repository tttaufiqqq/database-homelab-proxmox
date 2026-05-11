import React, { useState } from 'react';
import { ShoppingBag, ArrowRight, Minus, Plus, Trash2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from './Button';
import { motion, AnimatePresence } from 'motion/react';

export const Cart: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, totalPrice, totalItems, clearCart } = useCart();
  const { user, setAuthModalOpen, setAuthMode } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [isLoading, setIsLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ items: any[], total: number, id: string } | null>(null);
  
  const [checkoutForm, setCheckoutForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  
  const formatRM = (val: number) => `RM ${(val * 4.7).toFixed(2)}`;

  const handleProceedToCheckout = () => {
    if (!user) {
      setAuthMode('signin');
      setAuthModalOpen(true);
      return;
    }
    setFormError(null);
    setStep('checkout');
  };

  const handleCheckout = () => {
    setFormError(null);
    if (!checkoutForm.email || !checkoutForm.firstName || !checkoutForm.lastName || !checkoutForm.address) {
      setFormError("All shipping details are required to complete your order.");
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      if (Math.random() > 0.95) {
        setFormError("Payment authorization failed. Please check your ToyyibPay balance.");
        setIsLoading(false);
        return;
      }
      
      setLastOrder({
        items: [...cart],
        total: totalPrice,
        id: Math.random().toString(36).substr(2, 9).toUpperCase()
      });
      setIsLoading(false);
      setStep('success');
      clearCart();
      showToast('Payment successful!', 'success');
    }, 1500);
  };

  if (step === 'success' && lastOrder) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-full py-4 text-brand-primary"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-brand-primary text-white rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-lg font-bold uppercase tracking-widest">Payment Successful</h3>
          <p className="text-[8px] opacity-40 mt-1 uppercase tracking-[0.2em]">Order #{lastOrder.id}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 bg-brand-bg/50 border border-brand-border">
          <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6 pb-2 border-b border-brand-border">Purchase Receipt</h4>
          
          <div className="space-y-4 mb-8">
            {lastOrder.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="flex gap-3">
                  <span className="text-[10px] font-mono opacity-40">{item.quantity}x</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider">{item.name}</p>
                  </div>
                </div>
                <p className="text-[10px] font-mono">{formatRM(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t border-brand-border">
            <div className="flex justify-between text-[10px] uppercase tracking-widest">
              <span className="opacity-40">Subtotal</span>
              <span className="font-mono">{formatRM(lastOrder.total)}</span>
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-widest">
              <span className="opacity-40">Processing Fee</span>
              <span className="font-mono">{formatRM(0)}</span>
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-widest pt-4 font-bold">
              <span>Total Paid</span>
              <span className="font-mono">{formatRM(lastOrder.total)}</span>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-dotted border-brand-border text-center">
            <p className="text-[8px] uppercase tracking-[0.3em] opacity-30 leading-relaxed">
              Thank you for choosing arch·shop.<br />A soft copy has been sent to your email.
            </p>
          </div>
        </div>

        <Button 
          variant="primary" 
          fullWidth
          size="md" 
          className="mt-8" 
          onClick={() => { setStep('cart'); setLastOrder(null); }}
        >
          Continue Shopping
        </Button>
      </motion.div>
    );
  }

  if (cart.length === 0 && step === 'cart') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-400">
          <ShoppingBag size={24} />
        </div>
        <h3 className="text-lg font-medium text-zinc-900">Your cart is empty</h3>
        <p className="text-sm text-zinc-500 mt-2">Looks like you haven't added anything to your cart yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {step === 'checkout' && (
        <button 
          onClick={() => setStep('cart')}
          className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-brand-primary/50 hover:text-brand-primary transition-colors"
        >
          <ChevronLeft size={12} /> Back to Cart
        </button>
      )}

      <div className="flex-1 overflow-y-auto -mx-6 px-6">
        {step === 'cart' ? (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex gap-4"
                >
                  <div className="w-20 h-20 bg-zinc-100 rounded-md overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-900">{item.name}</h4>
                        <p className="text-[10px] font-mono text-zinc-400 mt-1">{formatRM(item.price)}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-zinc-300 hover:text-black transition-colors p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border border-brand-border">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-brand-bg text-brand-primary/50"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-8 text-center text-[10px] font-mono text-brand-primary">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-brand-bg text-brand-primary/50"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <p className="text-sm font-mono font-medium text-brand-primary">{formatRM(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Shipping Information</h4>
              <div className="space-y-3">
                <input 
                  type="email" 
                  placeholder="EMAIL ADDRESS" 
                  value={checkoutForm.email}
                  onChange={(e) => setCheckoutForm({...checkoutForm, email: e.target.value})}
                  className="w-full bg-transparent border border-brand-border p-3 text-[10px] uppercase tracking-widest outline-none focus:border-brand-primary"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="FIRST NAME" 
                    value={checkoutForm.firstName}
                    onChange={(e) => setCheckoutForm({...checkoutForm, firstName: e.target.value})}
                    className="w-full bg-transparent border border-brand-border p-3 text-[10px] uppercase tracking-widest outline-none focus:border-brand-primary"
                  />
                  <input 
                    type="text" 
                    placeholder="LAST NAME" 
                    value={checkoutForm.lastName}
                    onChange={(e) => setCheckoutForm({...checkoutForm, lastName: e.target.value})}
                    className="w-full bg-transparent border border-brand-border p-3 text-[10px] uppercase tracking-widest outline-none focus:border-brand-primary"
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="ADDRESS" 
                  value={checkoutForm.address}
                  onChange={(e) => setCheckoutForm({...checkoutForm, address: e.target.value})}
                  className="w-full bg-transparent border border-brand-border p-3 text-[10px] uppercase tracking-widest outline-none focus:border-brand-primary"
                />
              </div>
            </div>
            
            <div className="space-y-4 pt-6">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Payment Method</h4>
              <div className="p-4 border border-brand-primary bg-brand-primary/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-brand-primary">ToyyibPay Payment Gateway</span>
                  <span className="text-[8px] uppercase tracking-widest text-brand-primary/50 mt-1">FPX, Credit & Debit Card (Demo Mode)</span>
                </div>
                <div className="flex items-center">
                  <div className="px-2 py-1 bg-brand-primary text-white text-[8px] font-bold rounded uppercase tracking-tighter">toyyibPay</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="pt-8 border-t border-brand-border mt-6">
        <div className="space-y-4">
          <div className="flex justify-between text-[10px] uppercase tracking-widest">
            <span className="text-brand-primary/50">Subtotal</span>
            <span className="text-brand-primary font-mono">{formatRM(totalPrice)}</span>
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-widest pt-4 border-t border-brand-border">
            <span className="font-bold text-brand-primary">Total</span>
            <span className="font-mono font-bold text-brand-primary">{formatRM(totalPrice)}</span>
          </div>

          {formError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 bg-red-50 border border-red-100 flex items-center gap-3"
            >
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-red-600 leading-tight">
                {formError}
              </p>
            </motion.div>
          )}
          
          {step === 'cart' ? (
            <Button 
              fullWidth 
              size="lg" 
              className="mt-6" 
              onClick={handleProceedToCheckout}
            >
              Checkout <ArrowRight size={14} className="ml-2" />
            </Button>
          ) : (
            <Button 
              fullWidth 
              size="lg" 
              className="mt-6" 
              onClick={handleCheckout}
              disabled={isLoading}
            >
              {isLoading ? 'Redirecting to ToyyibPay...' : `Pay ${formatRM(totalPrice)} with ToyyibPay`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
