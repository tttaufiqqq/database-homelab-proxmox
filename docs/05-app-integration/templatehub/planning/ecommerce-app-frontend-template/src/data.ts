import { Product } from './types';

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Acoustic One Headphones',
    description: 'Precision-engineered wireless headphones with active noise cancellation and 40-hour battery life.',
    price: 349,
    category: 'Audio',
    image: 'https://picsum.photos/seed/headphones/800/800',
    featured: true,
  },
  {
    id: 'p2',
    name: 'Horizon Watch',
    description: 'A minimalist timepiece featuring a sustainable leather strap and sapphire crystal glass.',
    price: 199,
    category: 'Lifestyle',
    image: 'https://picsum.photos/seed/watch/800/800',
  },
  {
    id: 'p3',
    name: 'Prism Smart Speaker',
    description: 'Room-filling sound in a compact, architectural design. Supports all major streaming services.',
    price: 249,
    category: 'Audio',
    image: 'https://picsum.photos/seed/speaker/800/800',
  },
  {
    id: 'p4',
    name: 'Linear Desk Lamp',
    description: 'An ultra-slim dimmable LED lamp with touch-sensitive controls and adjustable color temperature.',
    price: 129,
    category: 'Home',
    image: 'https://picsum.photos/seed/lamp/800/800',
  },
  {
    id: 'p5',
    name: 'Evo Wireless Keyboard',
    description: 'A low-profile mechanical keyboard designed for maximum comfort and tactile feedback.',
    price: 159,
    category: 'Tech',
    image: 'https://picsum.photos/seed/keyboard/800/800',
    featured: true,
  },
  {
    id: 'p6',
    name: 'Nova Power Bank',
    description: 'A high-capacity 20,000mAh portable charger with dual USB-C output and fast charging.',
    price: 89,
    category: 'Tech',
    image: 'https://picsum.photos/seed/powerbank/800/800',
  }
];
