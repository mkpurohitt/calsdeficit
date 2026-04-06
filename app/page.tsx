"use client";
import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from "react";
import { useAuth } from "../lib/AuthContext";
import { useRouter } from "next/navigation";
import { Send, Camera, Video, FileText, Upload, LogOut, PlayCircle, Activity, Stethoscope } from "lucide-react";
import ReactMarkdown from 'react-markdown'; 
import { auth } from "../lib/firebase";
import AppLayout from "../components/AppLayout";

interface Message {
  role: 'user' | 'ai';
  text: string;
  file?: string | null;
}

export default function Dashboard() {
  const { user, loading } = useAuth() as { user: any; loading: boolean };
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Hello! I am your personal health assistant. Ask me anything or select a mode to start." }
  ]);
  const [input, setInput] = useState<string>("");
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

  const getFileTypes = () => {
    if (mode === 'food') return "image/*";
    if (mode === 'gym') return "video/*";
    if (mode === 'medical') return ".pdf,.doc,.docx,.txt,application/pdf"; 
    return "image/*";
  };

  const handleModeSwitch = (newMode: 'food' | 'gym' | 'medical') => {
    setMode(newMode);
    setFile(null); 
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

  if (loading) return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full recording" style={{ background: "var(--lime-400)" }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>Loading...</span>
      </div>
    </div>
  );

  const modeChips: { key: 'food' | 'gym' | 'medical'; icon: any; label: string }[] = [
    { key: 'food', icon: Camera, label: "Scan Food" },
    { key: 'gym', icon: Video, label: "Gym Form" },
    { key: 'medical', icon: FileText, label: "Medical" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 0px)" }}>
        
        {/* ── Top Bar ── */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{
            height: 60,
            background: "var(--surface-card)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div className="flex items-center gap-3">
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                color: "var(--text-primary)",
              }}
            >
              CalAI
            </h1>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "var(--radius-full)",
                background: "var(--lime-400)",
                display: "inline-block",
                boxShadow: "var(--shadow-lime-sm)",
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <a
              href="http://35.239.101.149/health-guidance"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2"
              style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: "var(--radius-full)" }}
            >
              <Stethoscope size={14} /> AI Doctor
            </a>
            <button
              onClick={handleLogout}
              className="btn-icon"
              style={{ width: 36, height: 36 }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ── Chat Messages ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
              style={{ animationDelay: "0s" }}
            >
              <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                {/* File preview */}
                {msg.file && (
                  msg.file.startsWith("blob") && msg.file.includes("pdf") ? (
                    <div
                      className="flex items-center gap-2 mb-2 p-2 rounded"
                      style={{ background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-sm)" }}
                    >
                      <FileText size={16} /> Document attached
                    </div>
                  ) : (
                    <img
                      src={msg.file}
                      alt="upload"
                      className="mb-2"
                      style={{ borderRadius: "var(--radius-md)", maxHeight: 160, objectFit: "cover" }}
                    />
                  )
                )}
                
                {/* 1. FOOD MODE CARD */}
                {msg.role === 'ai' && msg.text.includes('"food_name"') ? (
                   (() => {
                     try {
                       const cleanJson = msg.text.replace(/```json|```/g, '');
                       const data = JSON.parse(cleanJson);
                       return (
                         <div className="space-y-3">
                           <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--lime-400)" }}>{data.food_name}</h3>
                           <div style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>
                             {data.calories} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-tertiary)" }}>kcal</span>
                           </div>
                           <div className="grid grid-cols-3 gap-2 text-center">
                             {[
                               { label: "Protein", value: data.macros.protein, color: "var(--macro-protein)" },
                               { label: "Carbs", value: data.macros.carbs, color: "var(--macro-carbs)" },
                               { label: "Fat", value: data.macros.fats, color: "var(--macro-fat)" },
                             ].map((m, i) => (
                               <div key={i} style={{ background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "var(--radius-sm)" }}>
                                 <div style={{ color: m.color, fontWeight: 700, fontSize: 14, fontFamily: "var(--font-mono)" }}>{m.value}</div>
                                 <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>{m.label}</div>
                               </div>
                             ))}
                           </div>
                           <p style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", borderLeft: "2px solid var(--lime-400)", paddingLeft: 10 }}>
                             {data.health_tip}
                           </p>
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
                         <div className="flex items-center gap-2" style={{ color: "var(--lime-400)", fontWeight: 700, fontSize: 14 }}>
                           <Activity size={18} /> Form Analysis
                         </div>
                         <p className="whitespace-pre-wrap" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>{advice}</p>
                         <a
                           href={youtubeUrl}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="flex items-center justify-center gap-2 w-full py-2.5 font-medium"
                           style={{
                             background: "#FF0000",
                             color: "#FFFFFF",
                             borderRadius: "var(--radius-md)",
                             fontSize: 14,
                             transition: "background 0.15s",
                           }}
                         >
                           <PlayCircle size={16} /> Watch Correct Form
                         </a>
                       </div>
                     );
                  })()

                // 3. NORMAL TEXT
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                    <ReactMarkdown 
                      components={{
                        h1: ({node, ...props}) => <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--lime-400)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--lime-400)", marginBottom: 8, fontFamily: "var(--font-display)" }} {...props} />,
                        strong: ({node, ...props}) => <span style={{ fontWeight: 700, color: "var(--lime-400)" }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{ listStyleType: "disc", paddingLeft: 16, marginBottom: 8 }} {...props} />,
                        li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
                        p: ({node, ...props}) => <p style={{ marginBottom: 8 }} {...props} />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ── */}
        <div
          className="shrink-0 px-6 py-4"
          style={{
            background: "var(--surface-card)",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          {/* Mode Chips */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {modeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => handleModeSwitch(chip.key)}
                className="flex items-center gap-2 shrink-0"
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-full)",
                  fontSize: 13,
                  fontWeight: 600,
                  background: mode === chip.key ? "var(--lime-400)" : "var(--surface-elevated)",
                  color: mode === chip.key ? "#0A0C0F" : "var(--text-secondary)",
                  border: mode === chip.key ? "none" : "1px solid var(--border-color)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <chip.icon size={14} /> {chip.label}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <div className="flex items-center gap-2">
            <label
              className="btn-icon shrink-0"
              style={{ width: 44, height: 44, cursor: "pointer" }}
            >
              {mode === 'food' ? <Camera size={18} /> : mode === 'gym' ? <Video size={18} /> : <FileText size={18} />}
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
              placeholder={file ? `Attached: ${file.name}` : mode === 'chat' ? "Ask health queries..." : `Ask about your ${mode}...`}
              className="cl-input flex-1"
              style={{ borderRadius: "var(--radius-md)" }}
            />

            <button
              onClick={handleSend}
              disabled={!input && !file}
              className="btn-primary shrink-0 flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                padding: 0,
                borderRadius: "var(--radius-md)",
                opacity: !input && !file ? 0.4 : 1,
                cursor: !input && !file ? "not-allowed" : "pointer",
              }}
            >
              <Send size={18} />
            </button>
          </div>

          {/* File indicator */}
          {file && (
            <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: "var(--lime-400)" }}>
              <Upload size={12} />
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => setFile(null)}
                style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}