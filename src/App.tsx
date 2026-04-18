import { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  TrendingUp, 
  Users, 
  Package, 
  Send,
  Zap,
  Cpu,
  BarChart3
} from 'lucide-react';
import { auth, db, storage } from './lib/firebase';
import { processMessage } from './lib/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VoiceRecorder } from './components/VoiceRecorder';
import { BusinessSummary } from './components/BusinessSummary';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'chat' | 'stats' | 'inventory' | 'debts'>('chat');
  const [language, setLanguage] = useState<'pidgin' | 'english'>('pidgin');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', u.uid), {
            phoneNumber: u.phoneNumber || 'Anonymous',
            businessName: 'My Kiosk',
            createdAt: serverTimestamp(),
          });
        }
      } else {
        signInAnonymously(auth);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  useEffect(() => {
    if (scrollRef.current && view === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, view]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSendMessage = async (input: string | Blob) => {
    if (!user) {
      alert("System still dey connect, abeg wait small...");
      return;
    }
    if (isProcessing) return;
    if (typeof input === 'string' && !input.trim()) return;
    
    setIsProcessing(true);
    const textSnapshot = typeof input === 'string' ? input : '';
    setInputText(''); // Clear early for better UX
    setView('chat');
    
    try {
      let messageData: any = {
        userId: user.uid,
        timestamp: serverTimestamp(),
      };

      let geminiInput: any;

      if (typeof input === 'string') {
        messageData.text = input;
        messageData.sender = 'user';
        geminiInput = input;
      } else {
        // Handle Voice
        const voiceFileName = `voice_${Date.now()}.webm`;
        const storageRef = ref(storage, `voices/${user.uid}/${voiceFileName}`);
        await uploadBytes(storageRef, input);
        const voiceUrl = await getDownloadURL(storageRef);
        
        messageData.text = "🎤 [Voice Note]";
        messageData.voiceUrl = voiceUrl;
        messageData.sender = 'user';
        
        const base64Data = await blobToBase64(input);
        geminiInput = { data: base64Data, mimeType: input.type || 'audio/webm' };
      }

      // 1. Store user message
      await addDoc(collection(db, 'messages'), messageData);

      // 2. Process with Gemini
      const chatHistory = messages.slice(-5).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text || "" }]
      }));
      
      const extraction = await processMessage(geminiInput, chatHistory);
      
      // 3. Update database based on intent
      if (extraction.action === 'CREATE' || extraction.action === 'UPDATE') {
        await handleBusinessLogic(extraction, user.uid);
      }

      // 4. Store AI response
      await addDoc(collection(db, 'messages'), {
        text: extraction.response,
        sender: 'ai',
        userId: user.uid,
        timestamp: serverTimestamp(),
        extraction: extraction
      });
    } catch (error: any) {
      console.error('Error processing message:', error);
      alert(`Error: ${error.message || "Failed to send message"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBusinessLogic = async (extraction: any, uid: string) => {
    const { intent, entities } = extraction;
    
    if (intent === 'record_sale' && entities.item && (entities.amount || (entities.price && entities.quantity))) {
      const amount = entities.amount || (entities.price * entities.quantity);
      await addDoc(collection(db, 'transactions'), {
        userId: uid,
        type: 'sale',
        item: entities.item,
        quantity: entities.quantity || 1,
        amount: amount,
        timestamp: serverTimestamp()
      });
    } else if (intent === 'record_debt' && entities.customer && entities.amount) {
      await addDoc(collection(db, 'debts'), {
        userId: uid,
        customer: entities.customer,
        amount: entities.amount,
        type: 'owe_me',
        timestamp: serverTimestamp()
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-surface relative text-text-main">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-primary text-white z-10 shadow-md">
        <div className="flex flex-col">
          <h1 className="font-bold text-lg leading-tight">TradeMate AI</h1>
          <div className="flex items-center gap-1 opacity-80 text-[10px]">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            Business is active
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/20 p-1 rounded-full text-[10px]">
            <button 
              onClick={() => setLanguage('pidgin')}
              className={cn("px-3 py-1 rounded-full transition-all", language === 'pidgin' ? "bg-white text-primary font-bold shadow-sm" : "text-white")}
            >
              Pidgin
            </button>
            <button 
              onClick={() => setLanguage('english')}
              className={cn("px-3 py-1 rounded-full transition-all", language === 'english' ? "bg-white text-primary font-bold shadow-sm" : "text-white")}
            >
              English
            </button>
          </div>
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">
            👤
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col z-10">
        <AnimatePresence mode="wait">
          {view === 'chat' ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-40 space-y-4 text-center px-8">
                  <div className="p-6 bg-white rounded-full shadow-sm">
                    <Zap size={32} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium">
                    Welcome back, Chief! Wetin you wan do today?
                  </p>
                </div>
              )}
              
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    m.sender === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl text-[14px] leading-relaxed shadow-sm",
                    m.sender === 'user' 
                      ? "bg-primary text-white rounded-br-sm" 
                      : "bg-ai-bubble text-text-main rounded-bl-sm"
                  )}>
                    {m.voiceUrl && (
                      <audio src={m.voiceUrl} controls className={cn("mb-2 h-8 w-full", m.sender === 'user' ? "invert" : "")} />
                    )}
                    {m.text}
                  </div>
                  <span className="text-[10px] text-text-muted mt-1 px-1">
                    {new Date(m.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-primary font-medium text-xs mt-2 px-1"
                >
                  <div className="w-1.5 h-1.5 bg-primary animate-bounce rounded-full" />
                  AI is thinking...
                </motion.div>
              )}
            </motion.div>
          ) : view === 'stats' ? (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 overflow-y-auto px-4 py-6"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-primary mb-1">Akpan's Bread & Kiosk</h2>
                <p className="text-xs text-text-muted">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              {user && <BusinessSummary userId={user.uid} />}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Quick Actions Chips */}
        {view === 'chat' && (
          <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => handleSendMessage("Record Sale")}
              className="whitespace-nowrap px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-text-muted hover:bg-gray-50 transition-all"
            >
              Record Sale
            </button>
            <button 
              onClick={() => handleSendMessage("Check Debt")}
              className="whitespace-nowrap px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-text-muted hover:bg-gray-50 transition-all"
            >
              Check Debt
            </button>
            <button 
              onClick={() => setView('stats')}
              className="whitespace-nowrap px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-text-muted hover:bg-gray-50 transition-all"
            >
              Report
            </button>
          </div>
        )}

        {/* Navigation Bar */}
        <div className="grid grid-cols-4 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setView('chat')}
            className={cn("py-3 flex flex-col items-center gap-1 transition-all", view === 'chat' ? "text-primary bg-primary/5" : "text-text-muted")}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] font-bold">Chat</span>
          </button>
          <button 
            onClick={() => setView('stats')}
            className={cn("py-3 flex flex-col items-center gap-1 transition-all", view === 'stats' ? "text-primary bg-primary/5" : "text-text-muted")}
          >
            <BarChart3 size={20} />
            <span className="text-[10px] font-bold">Report</span>
          </button>
          <button className="py-3 flex flex-col items-center gap-1 text-text-muted/40 cursor-not-allowed">
            <Package size={20} />
            <span className="text-[10px] font-bold">Stock</span>
          </button>
          <button className="py-3 flex flex-col items-center gap-1 text-text-muted/40 cursor-not-allowed">
            <Users size={20} />
            <span className="text-[10px] font-bold">Debt</span>
          </button>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100 relative">
          {view === 'chat' ? (
            <div className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                  placeholder={user ? "Talk to TradeMate..." : "Connecting system..."}
                  disabled={!user}
                  className="w-full bg-gray-100 border-none rounded-full py-3 pl-6 pr-14 text-text-main text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none placeholder:text-text-muted/60 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendMessage(inputText)}
                  disabled={isProcessing || !user}
                  className="absolute right-1 text-white top-1/2 -translate-y-1/2 w-10 h-10 bg-primary rounded-full hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center shadow-md shadow-primary/20 active:scale-90"
                >
                  <Send size={18} />
                </button>
              </div>
              <VoiceRecorder 
                onRecordingComplete={(blob) => handleSendMessage(blob)}
                disabled={isProcessing || !user}
              />
            </div>
          ) : (
            <button 
              onClick={() => { setView('chat'); handleSendMessage("Wetin be my business status?"); }}
              className="w-full p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 font-bold text-sm"
            >
              <Zap size={18} />
              GET AI BUSINESS ADVICE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
