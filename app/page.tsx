"use client";
import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useRouter } from "next/navigation";
import { Send, Camera, Video, FileText, Upload, LogOut, PlayCircle, Activity, Stethoscope } from "lucide-react";
import ReactMarkdown from 'react-markdown'; 
import { auth } from "../lib/firebase";

interface Message {
  role: 'user' | 'ai';
  text: string;
  file?: string | null;
}

export default function Dashboard() {
  const { user, loading } = useAuth() as { user: any; loading: boolean };
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([
    // CHANGED: New welcome text
    { role: "ai", text: "Hello! I am your personal health assistant. Ask me anything or select a mode to start." }
  ]);
  const [input, setInput] = useState<string>("");
  // CHANGED: Default mode is now 'chat' (so no specific button is selected)
  const [mode, setMode] = useState<'chat' | 'food' | 'gym' | 'medical'>("chat");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- NEW: Helper to get allowed file types ---
  const getFileTypes = () => {
    if (mode === 'food') return "image/*";
    if (mode === 'gym') return "video/*";
    if (mode === 'medical') return ".pdf,.doc,.docx,.txt,application/pdf"; 
    return "image/*"; // fallback
  };

  // --- NEW: Clear file when switching modes ---
  const handleModeSwitch = (newMode: 'food' | 'gym' | 'medical') => {
    setMode(newMode);
    setFile(null); // Clear the old file because it might be the wrong type
  };

  const handleLogout = () => {
    auth.signOut();
    router.push("/login");
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    const userMsg: Message = { 
      role: "user", 
      text: input, 
      file: file ? URL.createObjectURL(file) : null 
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    
    const currentInput = input;
    const currentFile = file;
    setInput("");
    setFile(null);

    try {
      let fileData = null;
      let mimeType = null;

      if (currentFile) {
        fileData = await fileToBase64(currentFile);
        mimeType = currentFile.type;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          fileData: fileData,
          mimeType: mimeType,
          mode: mode
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [...prev, { role: "ai", text: data.data }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: "Error: " + (data.error || "Unknown error") }]);
      }

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "ai", text: "Something went wrong connecting to the server." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  if (loading) return <div className="h-screen bg-[#05110f] text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#05110f] text-white">
      
      {/* Header */}
      <header className="p-4 bg-[#0a1f1c] border-b border-gray-800 flex justify-between items-center shadow-md">
        {/* CHANGED: Removed the 💊 span */}
        <h1 className="text-xl font-bold flex items-center gap-2">
          CalsDeficit
        </h1>

        {/* --- PASTE THIS NEW BLOCK HERE --- */}
        <div className="flex items-center gap-3">
          <a 
            href="http://35.239.101.149/health-guidance" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-[#112926] text-[#00ff9d] border border-[#00ff9d] hover:bg-[#00ff9d] hover:text-black transition-all"
          >
            <Stethoscope size={16} /> AI Doctor
          </a>

          <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded-full">
            <LogOut className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        {/* -------------------------------- */}
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              msg.role === "user" 
                ? "bg-[#00ff9d] text-black rounded-br-none" 
                : "bg-[#112926] text-white border border-gray-700 rounded-bl-none"
            }`}>
              {msg.file && (
                msg.file.startsWith("blob") && msg.file.includes("pdf") ? (
                   <div className="flex items-center gap-2 mb-2 bg-black/20 p-2 rounded"><FileText /> Document attached</div>
                ) : (
                   <img src={msg.file} alt="upload" className="mb-2 rounded-lg max-h-40 object-cover" />
                )
              )}
              
              {/* --- SMART DISPLAY LOGIC --- */}
              
              {/* 1. FOOD MODE CARD */}
              {msg.role === 'ai' && msg.text.includes('"food_name"') ? (
                 (() => {
                   try {
                     const cleanJson = msg.text.replace(/```json|```/g, '');
                     const data = JSON.parse(cleanJson);
                     return (
                       <div className="space-y-2">
                         <h3 className="text-lg font-bold text-[#00ff9d]">{data.food_name}</h3>
                         <div className="text-3xl font-bold">{data.calories} <span className="text-sm font-normal text-gray-400">kcal</span></div>
                         <div className="grid grid-cols-3 gap-2 text-center text-sm my-2">
                           <div className="bg-black/30 p-2 rounded">
                             <div className="text-[#00ff9d] font-bold">{data.macros.protein}</div>
                             <div className="text-gray-500 text-xs">Prot</div>
                           </div>
                           <div className="bg-black/30 p-2 rounded">
                             <div className="text-[#00ff9d] font-bold">{data.macros.carbs}</div>
                             <div className="text-gray-500 text-xs">Carb</div>
                           </div>
                           <div className="bg-black/30 p-2 rounded">
                             <div className="text-[#00ff9d] font-bold">{data.macros.fats}</div>
                             <div className="text-gray-500 text-xs">Fat</div>
                           </div>
                         </div>
                         <p className="text-sm text-gray-300 italic border-l-2 border-[#00ff9d] pl-2">{data.health_tip}</p>
                       </div>
                     );
                   } catch (e) {
                     return <p className="whitespace-pre-wrap">{msg.text}</p>;
                   }
                 })()
              
              // 2. GYM MODE CARD
              ) : msg.role === 'ai' && msg.text.includes('SEARCH_QUERY:') ? (
                (() => {
                   const parts = msg.text.split('SEARCH_QUERY:');
                   const advice = parts[0].trim();
                   const query = parts[1] ? parts[1].trim() : "fitness";
                   const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

                   return (
                     <div className="space-y-3">
                       <div className="flex items-center gap-2 text-[#00ff9d] font-bold mb-1">
                         <Activity size={20} /> Form Analysis
                       </div>
                       <p className="whitespace-pre-wrap text-sm leading-relaxed">{advice}</p>
                       <div className="pt-2">
                         <a 
                           href={youtubeUrl} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="flex items-center justify-center gap-2 w-full bg-[#ff0000] hover:bg-[#cc0000] text-white py-2 rounded-xl transition-all font-medium"
                         >
                           <PlayCircle size={18} /> Watch Correct Form
                         </a>
                       </div>
                     </div>
                   );
                })()

              // 3. NORMAL TEXT
              ) : (
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown 
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-xl font-bold text-[#00ff9d] mb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-bold text-[#00ff9d] mb-2" {...props} />,
                      strong: ({node, ...props}) => <span className="font-bold text-[#00ff9d]" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 mb-2" {...props} />,
                      li: ({node, ...props}) => <li className="marker:text-[#00ff9d]" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}

            </div>
          </div>
        ))}
        {isProcessing && (
           <div className="flex justify-start">
             <div className="bg-[#112926] p-4 rounded-2xl rounded-bl-none border border-gray-700">
               <span className="animate-pulse text-[#00ff9d]">Thinking...</span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0a1f1c] border-t border-gray-800">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {/* UPDATED: Buttons now use handleModeSwitch to clear files */}
          <button onClick={() => handleModeSwitch('food')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'food' ? 'bg-[#00ff9d] text-black' : 'bg-[#112926] text-gray-300 border border-gray-700'}`}><Camera size={16} /> Food Photo</button>
          <button onClick={() => handleModeSwitch('gym')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'gym' ? 'bg-[#00ff9d] text-black' : 'bg-[#112926] text-gray-300 border border-gray-700'}`}><Video size={16} /> Gym Video</button>
          <button onClick={() => handleModeSwitch('medical')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'medical' ? 'bg-[#00ff9d] text-black' : 'bg-[#112926] text-gray-300 border border-gray-700'}`}><FileText size={16} /> Medical Report</button>
        </div>

        <div className="relative flex items-center gap-2">
          <label className="cursor-pointer p-3 hover:bg-gray-800 rounded-full text-gray-400 transition-colors">
            {/* UPDATED: Dynamic Icon based on mode */}
            {mode === 'food' ? <Camera size={20} /> : mode === 'gym' ? <Video size={20} /> : <FileText size={20} />}
            
            {/* UPDATED: The Input now uses the dynamic accept attribute */}
            <input 
              type="file" 
              className="hidden" 
              accept={getFileTypes()} 
              onChange={handleFileChange} 
            />
          </label>
          
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={handleKeyDown} 
            // CHANGED: Custom placeholder for 'chat' mode
            placeholder={file ? `Attached: ${file.name}` : mode === 'chat' ? "Ask health queries..." : `Ask about your ${mode}...`} 
            className="flex-1 bg-[#05110f] border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#00ff9d]" 
          />
          <button onClick={handleSend} disabled={!input && !file} className="p-3 bg-[#00ff9d] hover:bg-[#00cc7d] text-black rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Send size={20} /></button>
        </div>
      </div>
    </div>
  );
}