/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ShoppingBag, Search, Menu, X, ArrowRight, Instagram, Twitter, Facebook } from 'lucide-react';
import { products } from './data';
import { ProductCard } from './components/ProductCard';
import { Drawer } from './components/Drawer';
import { Modal } from './components/Modal';
import { Cart } from './components/Cart';
import { Button } from './components/Button';
import { AdminDashboard } from './components/AdminDashboard';
import { CartProvider, useCart } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ToastProvider } from './context/ToastContext';

function Navbar({ activeCategory, setActiveCategory, view, setView }: { activeCategory: string, setActiveCategory: (cat: string) => void, view: 'shop' | 'admin', setView: (v: 'shop' | 'admin') => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { totalItems } = useCart();
  const { user, signOut, isAuthModalOpen, setAuthModalOpen, authMode, setAuthMode } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const categories = ['Audio', 'Tech', 'Home', 'Lifestyle'];

  const handleCategorySelect = (cat: string) => {
    setView('shop');
    setActiveCategory(cat);
    setIsMenuOpen(false);
    setTimeout(() => {
      document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleHomeClick = () => {
    setView('shop');
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <nav className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 border-b border-brand-border bg-white`}>
        <div className="max-w-7xl mx-auto h-20 px-4 md:px-10 flex items-center justify-between gap-4">
          {/* Logo & Desktop Nav */}
          <div className={`flex items-center gap-12 transition-all duration-300 ${isSearchOpen ? 'w-0 opacity-0 invisible overflow-hidden' : 'opacity-100 visible'}`}>
            <button onClick={handleHomeClick} className="text-xl md:text-2xl font-bold tracking-tighter uppercase text-brand-primary cursor-pointer shrink-0">
              ARCH·SHOP
            </button>
            <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-widest font-medium shrink-0">
              <button
                onClick={() => handleCategorySelect('all')}
                className={`${view === 'shop' && activeCategory === 'all' ? 'border-b border-brand-primary pb-1' : 'text-brand-primary/50 hover:text-brand-primary'} transition-all cursor-pointer`}
              >
                New Arrivals
              </button>
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => handleCategorySelect(item)}
                  className={`${view === 'shop' && activeCategory === item ? 'border-b border-brand-primary pb-1' : 'text-brand-primary/50 hover:text-brand-primary'} transition-all cursor-pointer`}
                >
                  {item}
                </button>
              ))}
              {user && (
                <button
                  onClick={() => { setView('admin'); window.scrollTo({ top: 0 }); }}
                  className={`${view === 'admin' ? 'border-b border-brand-primary pb-1' : 'text-brand-primary/50 hover:text-brand-primary'} transition-all cursor-pointer`}
                >
                  Admin
                </button>
              )}
            </div>
          </div>

          {/* Inline Search Bar */}
          <div className={`flex-1 flex items-center transition-all duration-300 ${isSearchOpen ? 'opacity-100 visible' : 'w-0 opacity-0 invisible overflow-hidden'}`}>
            <div className="relative w-full max-w-xl mx-auto">
              <input
                autoFocus={isSearchOpen}
                type="text"
                placeholder="SEARCH..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-brand-primary/20 py-2 text-[10px] md:text-xs uppercase tracking-widest outline-none focus:border-brand-primary transition-colors"
                onKeyDown={(e) => e.key === 'Escape' && setIsSearchOpen(false)}
              />
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-brand-primary/50 hover:text-brand-primary"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 md:gap-6 shrink-0">
            <div className="hidden lg:flex items-center gap-4 mr-2">
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-brand-primary/60">
                    Hello, {user.email.split('@')[0]}
                  </span>
                  <button 
                    onClick={signOut}
                    className="text-[10px] uppercase tracking-widest font-bold text-brand-primary hover:text-brand-primary/60 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => { setAuthMode('signin'); setAuthModalOpen(true); }}
                    className="text-[10px] uppercase tracking-widest font-bold text-brand-primary hover:text-brand-primary/60 transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { setAuthMode('signup'); setAuthModalOpen(true); }}
                    className="text-[10px] uppercase tracking-widest font-bold text-brand-primary hover:text-brand-primary/60 transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

            {!isSearchOpen && (
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-8 h-8 md:w-10 md:h-10 border border-brand-primary/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-primary hover:text-white transition-all"
              >
                <Search size={16} />
              </button>
            )}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative w-8 h-8 md:w-10 md:h-10 border border-brand-primary/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-primary hover:text-white transition-all"
            >
              <ShoppingBag size={16} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-primary text-white text-[9px] rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            {!isSearchOpen && (
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="md:hidden w-8 h-8 border border-brand-primary/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-primary hover:text-white transition-all"
              >
                <Menu size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Your Bag"
      >
        <Cart />
      </Modal>

      <Drawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Navigation"
      >
        <div className="flex flex-col h-full">
          <div className="flex flex-col gap-6">
            <button
              onClick={() => handleCategorySelect('all')}
              className={`text-sm uppercase tracking-[0.2em] font-bold text-left py-2 border-b ${activeCategory === 'all' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-primary/50'}`}
            >
              New Arrivals
            </button>
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => handleCategorySelect(item)}
                className={`text-sm uppercase tracking-[0.2em] font-bold text-left py-2 border-b ${activeCategory === item ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-primary/50'}`}
              >
                {item}
              </button>
            ))}
            {user && (
              <button
                onClick={() => { setView('admin'); setIsMenuOpen(false); window.scrollTo({ top: 0 }); }}
                className={`text-sm uppercase tracking-[0.2em] font-bold text-left py-2 border-b ${view === 'admin' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-primary/50'}`}
              >
                Admin Dashboard
              </button>
            )}
          </div>

          <div className="mt-12 space-y-6">
             <div className="space-y-4">
               {user ? (
                 <>
                   <p className="text-[10px] uppercase tracking-widest text-brand-primary/40 font-bold border-b border-brand-border pb-2">
                     Account: {user.email}
                   </p>
                   <button 
                     onClick={() => { signOut(); setIsMenuOpen(false); }}
                     className="block w-full text-left text-[11px] uppercase tracking-widest font-bold text-brand-primary"
                   >
                     Logout
                   </button>
                 </>
               ) : (
                 <div className="grid grid-cols-2 gap-4">
                   <button 
                     onClick={() => { setAuthMode('signin'); setAuthModalOpen(true); setIsMenuOpen(false); }}
                     className="py-3 border border-brand-primary text-[10px] uppercase tracking-widest font-bold text-brand-primary text-center hover:bg-brand-primary hover:text-white transition-all"
                   >
                     Sign In
                   </button>
                   <button 
                     onClick={() => { setAuthMode('signup'); setAuthModalOpen(true); setIsMenuOpen(false); }}
                     className="py-3 bg-brand-primary text-[10px] uppercase tracking-widest font-bold text-white text-center hover:bg-brand-primary/90 transition-all"
                   >
                     Sign Up
                   </button>
                 </div>
               )}
             </div>

             <div className="space-y-4 pt-6 border-t border-brand-border">
                <a href="#lookbook" onClick={() => setIsMenuOpen(false)} className="block text-[10px] uppercase tracking-widest text-brand-primary/60 font-bold">Lookbook</a>
                <a href="#" className="block text-[10px] uppercase tracking-widest text-brand-primary/60 font-bold">About Us</a>
                <a href="#" className="block text-[10px] uppercase tracking-widest text-brand-primary/60 font-bold">Journal</a>
             </div>
          </div>
        </div>
      </Drawer>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        initialMode={authMode} 
      />
    </>
  );
}

function Hero() {
  const scrollToShop = () => {
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToLookbook = () => {
    document.getElementById('lookbook')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[80vh] flex items-stretch mt-20 border-b border-brand-border">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Left Side: Content */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex-1 border-r border-brand-border p-10 md:p-20 flex flex-col justify-center bg-white"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-primary/40 mb-4">Collection 2026</span>
          <h1 className="text-6xl md:text-8xl font-light tracking-tight leading-[0.9] mb-8 text-brand-primary">
            Geometric<br/><span className="font-medium italic">Serenity</span>
          </h1>
          <p className="max-w-md text-sm text-brand-primary/60 leading-relaxed mb-10">
            A curation of minimal lifestyle objects designed with mathematical precision. Every angle serves a purpose, every curve defines a shadow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="primary" size="md" onClick={scrollToShop}>Shop Now</Button>
            <Button variant="outline" size="md" onClick={scrollToLookbook}>Lookbook</Button>
          </div>
        </motion.div>

        {/* Right Side: Imagery */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex-1 bg-brand-light/30 flex items-center justify-center relative overflow-hidden py-20"
        >
          <div className="w-4/5 aspect-square bg-brand-light/50 flex items-center justify-center shadow-2xl transform rotate-3 overflow-hidden">
             <img 
               src="https://images.unsplash.com/photo-1542393545-10f5cde2c810?auto=format&fit=crop&q=80&w=1000" 
               className="w-full h-full object-cover"
               referrerPolicy="no-referrer"
             />
             <div className="absolute inset-0 bg-black/5" />
          </div>
          <div className="absolute bottom-8 right-8 text-right">
            <div className="text-xs font-mono">Model №092</div>
            <div className="text-xs font-mono uppercase opacity-50">Studio Edition</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ProductGrid({ category }: { category: string }) {
  const filteredProducts = category === 'all' 
    ? products 
    : products.filter(p => p.category === category);

  return (
    <section id="shop" className="bg-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 min-h-[400px]">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product, idx) => (
            <div 
              key={product.id}
              className={`border-b border-brand-border md:border-r ${idx % 4 === 3 ? 'lg:border-r-0' : ''}`}
            >
              <ProductCard product={product} />
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-primary/40">
              No products found in this category.
            </p>
          </div>
        )}

        {/* Newsletter Section Integrated into Grid */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-brand-primary text-white p-10 flex flex-col justify-center items-center text-center border-b border-brand-border">
          <div className="text-[10px] uppercase tracking-widest mb-4 opacity-50 font-bold">Newsletter</div>
          <h4 className="text-2xl font-light mb-8 text-brand-light">Join the Circle</h4>
          <div className="w-full max-w-xs flex border-b border-white/30 pb-2">
            <input 
              type="text" 
              placeholder="EMAIL ADDRESS" 
              className="bg-transparent text-[10px] uppercase tracking-widest flex-1 outline-none placeholder:text-white/30"
            />
            <button className="text-[10px] font-bold uppercase hover:text-brand-light transition-colors">Sign Up</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureSection({ onLearnMore }: { onLearnMore: () => void }) {
  return (
    <section className="py-24 bg-zinc-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 space-y-8">
          <span className="text-xs font-semibold tracking-[0.3em] uppercase text-zinc-400">
            Craftsmanship
          </span>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[0.9]">
            REFINED DOWN TO THE SMALLEST DETAIL.
          </h2>
          <p className="text-zinc-400 text-lg">
            Our products are engineered for longevity, using only the finest sustainable materials that age beautifully over time.
          </p>
          <ul className="space-y-4 pt-4">
            {['Sustainably Sourced', 'Ergonomic Excellence', 'Intelligent Tech'].map((feat) => (
              <li key={feat} className="flex items-center gap-4 text-zinc-100">
                <div className="w-6 h-px bg-zinc-500" />
                {feat}
              </li>
            ))}
          </ul>
          <Button 
            variant="outline" 
            className="text-white border-zinc-700 hover:bg-zinc-800 rounded-full px-8 mt-4"
            onClick={onLearnMore}
          >
            Learn More <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        <div className="flex-1 relative">
          <div className="aspect-[4/5] rounded-2xl overflow-hidden relative group">
            <img
              src="https://images.unsplash.com/photo-1542393545-10f5cde2c810?auto=format&fit=crop&q=80&w=1000"
              alt="Design Detail"
              className="w-full h-full object-cover transition-all duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 border border-white/10 m-4 rounded-xl pointer-events-none" />
          </div>
          <div className="absolute -bottom-8 -left-8 bg-zinc-800 p-8 rounded-xl shadow-2xl hidden lg:block max-w-xs transform -rotate-3">
             <p className="italic text-zinc-400 text-sm">
               "Lumina represents the perfect intersection of form and digital functionality."
             </p>
             <p className="mt-4 font-bold text-xs uppercase tracking-widest text-white">— Design Weekly</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer bg-white border-t border-brand-border">
      <div className="max-w-7xl mx-auto py-10 md:py-0 md:h-12 flex flex-col md:flex-row items-center justify-between px-6 md:px-10 text-[9px] uppercase tracking-[0.2em] font-bold gap-8 md:gap-0">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 items-center">
          <a href="#" className="hover:text-brand-primary/50 transition-colors text-brand-primary whitespace-nowrap">Shipping Policy</a>
          <a href="#" className="hover:text-brand-primary/50 transition-colors text-brand-primary whitespace-nowrap">Terms of Service</a>
          <a href="#" className="hover:text-brand-primary/50 transition-colors text-brand-primary whitespace-nowrap">Privacy</a>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 items-center">
          <a href="#" className="hover:text-brand-primary/50 transition-colors text-brand-primary whitespace-nowrap">Instagram</a>
          <a href="#" className="hover:text-brand-primary/50 transition-colors text-brand-primary whitespace-nowrap">Pinterest</a>
          <span className="text-brand-primary/30 whitespace-nowrap">© 2026 ARCH·SHOP STUDIO</span>
        </div>
      </div>
    </footer>
  );
}

function Lookbook() {
  const images = [
    "https://images.unsplash.com/photo-1542393545-10f5cde2c810?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1554034483-04fda0d3507b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&q=80&w=800"
  ];

  return (
    <section id="lookbook" className="py-24 bg-white border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-10 text-center mb-16">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-primary/40 mb-4 inline-block">Visual Journal</span>
        <h2 className="text-3xl md:text-5xl font-light tracking-tight text-brand-primary">THE LOOKBOOK — 026</h2>
      </div>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
        {images.map((img, idx) => (
          <div key={idx} className="aspect-[3/4] overflow-hidden group border border-brand-border">
            <img 
              src={img} 
              alt={`Lookbook ${idx}`} 
              className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [category, setCategory] = useState('all');
  const [view, setView] = useState<'shop' | 'admin'>('shop');
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  return (
    <AuthProvider>
      <ToastProvider>
        <CartProvider>
          <div className="min-h-screen bg-white font-sans selection:bg-brand-primary selection:text-white">
            <Navbar activeCategory={category} setActiveCategory={setCategory} view={view} setView={setView} />
            <main className={view === 'admin' ? 'pt-20' : ''}>
              {view === 'shop' ? (
                <>
                  <Hero />
                  <ProductGrid category={category} />
                  <FeatureSection onLearnMore={() => setIsLearnMoreOpen(true)} />
                  <Lookbook />
                </>
              ) : (
                <AdminDashboard />
              )}
            </main>
            <Footer />
            <Modal 
              isOpen={isLearnMoreOpen} 
              onClose={() => setIsLearnMoreOpen(false)} 
              title="Our Craftsmanship"
            >
              <div className="space-y-8">
                <div className="aspect-video overflow-hidden rounded-sm border border-brand-border bg-brand-bg">
                  <img 
                    src="https://images.unsplash.com/photo-1542393545-10f5cde2c810?auto=format&fit=crop&q=80&w=1200"
                    alt="Craftsmanship Process"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary/40">Philosophy</span>
                    <h3 className="text-xl font-light tracking-tight text-brand-primary uppercase">Geometric Integrity</h3>
                    <p className="text-sm text-brand-primary/60 leading-relaxed">
                      Every piece is designed starting from raw geometric primitives. We believe that by adhering to strict mathematical proportions, we achieve a timeless aesthetic that transcends trends. Each angle is calculated to interact with light and shadow in a specific way.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary/40">Processes</span>
                    <h3 className="text-xl font-light tracking-tight text-brand-primary uppercase">Sustainable Engineering</h3>
                    <p className="text-sm text-brand-primary/60 leading-relaxed">
                      We utilize regenerative manufacturing processes. Our aluminum is 100% recycled high-grade alloy, anodized for lifetime durability. By minimizing material waste and focusing on mono-material constructions, we ensure every Lumina object can be fully recycled at the end of its life.
                    </p>
                  </div>
                </div>

                <div className="pt-8 border-t border-brand-border">
                   <div className="grid grid-cols-3 gap-6 text-center">
                     <div>
                       <div className="text-xl font-mono font-medium text-brand-primary">0.01mm</div>
                       <div className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mt-1">Precision</div>
                     </div>
                     <div>
                       <div className="text-xl font-mono font-medium text-brand-primary">100%</div>
                       <div className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mt-1">Recyclable</div>
                     </div>
                     <div>
                       <div className="text-xl font-mono font-medium text-brand-primary">250+</div>
                       <div className="text-[9px] uppercase tracking-widest text-brand-primary/40 font-bold mt-1">Testing Hours</div>
                     </div>
                   </div>
                </div>
              </div>
            </Modal>
          </div>
        </CartProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
