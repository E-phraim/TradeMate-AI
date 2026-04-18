import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  sum 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { DollarSign, TrendingUp, Users } from 'lucide-react';

export function BusinessSummary({ userId }: { userId: string }) {
  const [totalSales, setTotalSales] = useState(0);
  const [totalDebts, setTotalDebts] = useState(0);

  useEffect(() => {
    const qSales = query(collection(db, 'transactions'), where('userId', '==', userId), where('type', '==', 'sale'));
    const unsubSales = onSnapshot(qSales, (snap) => {
      const total = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setTotalSales(total);
    });

    const qDebts = query(collection(db, 'debts'), where('userId', '==', userId), where('type', '==', 'owe_me'));
    const unsubDebts = onSnapshot(qDebts, (snap) => {
      const total = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setTotalDebts(total);
    });

    return () => {
      unsubSales();
      unsubDebts();
    };
  }, [userId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 bg-white rounded-2xl stat-card-shadow border border-gray-100 flex flex-col justify-between min-h-[120px]"
        >
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Sales Today</p>
          <p className="text-2xl font-black text-primary">₦{totalSales.toLocaleString()}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-5 bg-white rounded-2xl stat-card-shadow border border-gray-100 flex flex-col justify-between min-h-[120px]"
        >
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">People Wey Owe You</p>
          <p className="text-2xl font-black text-red-600">₦{totalDebts.toLocaleString()}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-5 bg-white rounded-2xl stat-card-shadow border border-gray-100 flex flex-col justify-between min-h-[120px]"
        >
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Top Item</p>
          <p className="text-xl font-black text-text-main">Agege Bread</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="p-5 bg-white rounded-2xl stat-card-shadow border border-gray-100 flex flex-col justify-between min-h-[120px]"
        >
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Inventory Alert</p>
          <p className="text-xl font-black text-market-gold">Low Milk</p>
        </motion.div>
      </div>

      <div className="bg-white rounded-2xl stat-card-shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-text-main">Last Transactions</h3>
          <button className="text-[10px] font-bold text-primary">See All</button>
        </div>
        <div className="divide-y divide-gray-50 px-4">
          <div className="py-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold">2x Agege Bread</p>
              <p className="text-[10px] text-text-muted">2 mins ago • Cash Sale</p>
            </div>
            <p className="text-sm font-bold text-primary">+₦1,000</p>
          </div>
          <div className="py-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold">Musa (Debt)</p>
              <p className="text-[10px] text-text-muted">5 mins ago • Pure Water</p>
            </div>
            <p className="text-sm font-bold text-red-600">₦2,000</p>
          </div>
        </div>
      </div>
    </div>
  );
}
