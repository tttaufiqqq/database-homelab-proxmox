import React from 'react';
import { Product } from '../types';
import { Button } from './Button';
import { motion } from 'motion/react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { showToast } = useToast();

  return (
    <div className="group p-6 bg-white hover:bg-brand-primary hover:text-white transition-colors cursor-pointer flex flex-col h-full">
      <div className="aspect-square w-full bg-brand-light/10 mb-6 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-all duration-500"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex justify-between items-start mt-auto">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-1">
            {product.name}
          </h3>
          <p className="text-[10px] opacity-60 uppercase tracking-widest">{product.category}</p>
        </div>
        <span className="text-xs font-mono font-medium">RM {(product.price * 4.7).toFixed(2)}</span>
      </div>
      <div className="mt-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 translate-y-0 md:translate-y-2 md:group-hover:translate-y-0">
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            addToCart(product);
            showToast(`${product.name} added to cart`, 'success');
          }}
          variant="primary" 
          fullWidth 
          size="sm"
          className="bg-brand-primary text-white md:bg-white md:text-brand-primary md:hover:bg-brand-primary md:hover:text-white"
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};
