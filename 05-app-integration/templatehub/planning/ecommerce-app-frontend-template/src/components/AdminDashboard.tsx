/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, 
  ArrowUpRight, ArrowDownRight, Package, Clock,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';

const salesData = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const categoryData = [
  { name: 'Audio', value: 400 },
  { name: 'Tech', value: 300 },
  { name: 'Home', value: 300 },
  { name: 'Lifestyle', value: 200 },
];

const COLORS = ['#111111', '#444444', '#888888', '#CCCCCC'];

export const AdminDashboard: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const monthIndex = months.indexOf(e.target.value);
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
    setSelectedDay(null);
  };

  const handleMonthChangeByIndex = (index: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), index, 1));
    setSelectedDay(null);
  };

  const mockEvents: { [key: number]: { time: string, title: string }[] } = {
    5: [{ time: '10:00', title: 'Marketing Review' }],
    12: [{ time: '09:00', title: 'Inventory Sync' }, { time: '14:00', title: 'Team Sync' }],
    18: [{ time: '11:00', title: 'Supplier Call' }],
    24: [{ time: '14:00', title: 'Stock Shipment Arrival' }],
  };

  const currentMonthName = months[currentDate.getMonth()];

  return (
    <div className="p-6 md:p-10 bg-brand-bg min-h-screen">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-primary/40 mb-2 block">
              System Overview
            </span>
            <h1 className="text-4xl font-light tracking-tighter text-brand-primary uppercase">
              Admin Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="flex items-center gap-3 px-4 py-3 border border-brand-border bg-white hover:border-brand-primary transition-all min-w-[160px]"
              >
                <CalendarIcon size={12} className="text-brand-primary/40" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-primary flex-1 text-left">
                  {currentMonthName}
                </span>
                <motion.div
                  animate={{ rotate: isMonthDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight size={10} className="rotate-90" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isMonthDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsMonthDropdownOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-brand-border shadow-2xl z-20 max-h-[300px] overflow-y-auto"
                    >
                      {months.map((m, idx) => (
                        <button
                          key={m}
                          onClick={() => {
                            handleMonthChangeByIndex(idx);
                            setIsMonthDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[9px] uppercase tracking-widest font-bold transition-colors hover:bg-brand-bg ${currentMonthName === m ? 'text-brand-primary bg-brand-bg' : 'text-brand-primary/40'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Revenue" 
            value="RM 42,390.00" 
            trend="+12.5%" 
            trendUp={true}
            icon={<DollarSign size={20} />} 
          />
          <StatCard 
            title="Total Orders" 
            value="1,284" 
            trend="+8.2%" 
            trendUp={true}
            icon={<ShoppingBag size={20} />} 
          />
          <StatCard 
            title="Conversion Rate" 
            value="3.42%" 
            trend="-0.5%" 
            trendUp={false}
            icon={<TrendingUp size={20} />} 
          />
          <StatCard 
            title="Active Users" 
            value="892" 
            trend="+24.1%" 
            trendUp={true}
            icon={<Users size={20} />} 
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Custom Calendar UI */}
          <div className="bg-white p-8 border border-brand-border">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-primary flex items-center gap-2">
                <CalendarIcon size={14} /> Schedule — {currentMonthName}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 hover:bg-brand-bg transition-colors"><ChevronLeft size={14} /></button>
                <button onClick={nextMonth} className="p-1 hover:bg-brand-bg transition-colors"><ChevronRight size={14} /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-y-4 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <span key={day} className="text-[9px] font-bold text-brand-primary/30 uppercase">{day}</span>
              ))}
              
              {Array.from({ length: firstDayOfMonth(currentDate.getMonth(), currentDate.getFullYear()) }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              
              {Array.from({ length: daysInMonth(currentDate.getMonth(), currentDate.getFullYear()) }).map((_, i) => {
                const day = i + 1;
                const isSelected = day === selectedDay;
                const hasOrder = mockEvents[day];
                
                return (
                  <div key={day} className="flex flex-col items-center gap-1 py-1">
                    <span 
                      onClick={() => setSelectedDay(day)}
                      className={`text-[10px] font-mono w-6 h-6 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-brand-primary text-white font-bold' : 'text-brand-primary hover:bg-brand-bg'}`}
                    >
                      {day}
                    </span>
                    {hasOrder && <div className="w-1 h-1 bg-brand-primary rounded-full" />}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 pt-8 border-t border-brand-border space-y-4">
              <h4 className="text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">
                Events for {currentMonthName} {selectedDay || '...'}
              </h4>
              {selectedDay && mockEvents[selectedDay] ? (
                mockEvents[selectedDay].map((ev, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-brand-bg/50 border-l-2 border-brand-primary">
                    <div className="text-[9px] font-mono font-bold w-10">{ev.time}</div>
                    <div className="text-[9px] uppercase tracking-widest font-bold">{ev.title}</div>
                  </div>
                ))
              ) : (
                <p className="text-[9px] uppercase tracking-widest font-bold text-brand-primary/20 italic">No events scheduled.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-8 border border-brand-border">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-primary mb-8">{currentMonthName} Sales Performance</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#111111" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#111111" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#999' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#999' }}
                    tickFormatter={(value) => `RM${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ border: '1px solid #f0f0f0', borderRadius: '0', fontSize: '10px', textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#111111" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 border border-brand-border lg:col-span-1">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-primary mb-8">Category Distribution</h3>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categoryData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  <span className="text-[9px] uppercase tracking-widest font-bold text-brand-primary/60">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white border border-brand-border overflow-hidden">
          <div className="p-8 border-b border-brand-border flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-primary">Recent Orders</h3>
            <button className="text-[9px] uppercase tracking-widest font-bold border-b border-brand-primary pb-px hover:opacity-50 transition-all">View All Orders</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-brand-bg/50">
                  <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">Order ID</th>
                  <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">Customer</th>
                  <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">Status</th>
                  <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">Amount</th>
                  <th className="px-8 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                <OrderRow id="#9281" name="Sarah Jenkins" status="Processing" amount="RM 1,299.00" date="2 mins ago" />
                <OrderRow id="#9280" name="Michael Chen" status="Shipped" amount="RM 450.00" date="14 mins ago" />
                <OrderRow id="#9279" name="Emma Wilson" status="Delivered" amount="RM 2,100.00" date="1 hour ago" />
                <OrderRow id="#9278" name="James Robert" status="Shipped" amount="RM 185.00" date="3 hours ago" />
                <OrderRow id="#9277" name="Linda Carter" status="Processing" amount="RM 899.00" date="5 hours ago" />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode }> = ({ title, value, trend, trendUp, icon }) => (
  <div className="bg-white p-6 border border-brand-border flex flex-col justify-between">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 bg-brand-bg text-brand-primary">
        {icon}
      </div>
      <div className={`flex items-center text-[9px] font-bold ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
        {trendUp ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
        {trend}
      </div>
    </div>
    <div>
      <p className="text-[9px] uppercase tracking-widest font-bold text-brand-primary/40 mb-1">{title}</p>
      <p className="text-2xl font-light tracking-tight text-brand-primary">{value}</p>
    </div>
  </div>
);

const OrderRow: React.FC<{ id: string, name: string, status: string, amount: string, date: string }> = ({ id, name, status, amount, date }) => (
  <tr className="hover:bg-brand-bg/20 transition-colors">
    <td className="px-8 py-6 font-mono text-[10px] text-brand-primary font-bold">{id}</td>
    <td className="px-8 py-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-bg flex items-center justify-center text-[10px] font-bold text-brand-primary">
          {name.split(' ').map(n => n[0]).join('')}
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-brand-primary">{name}</span>
      </div>
    </td>
    <td className="px-8 py-6">
      <span className={`text-[8px] uppercase tracking-[0.2em] font-bold px-2 py-1 rounded-full ${
        status === 'Delivered' ? 'bg-green-50 text-green-700' : 
        status === 'Shipped' ? 'bg-blue-50 text-blue-700' : 
        'bg-orange-50 text-orange-700'
      }`}>
        {status}
      </span>
    </td>
    <td className="px-8 py-6 font-mono text-[10px] text-brand-primary font-bold">{amount}</td>
    <td className="px-8 py-6 text-[9px] uppercase tracking-widest font-bold text-brand-primary/40">{date}</td>
  </tr>
);
