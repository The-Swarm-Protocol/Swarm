"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, User, Loader2, ImagePlus, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string; // base64
  timestamp: Date;
}

export function GeminiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I'm your **Gemini Live Agent**. I can analyze UIs, plan actions, and automate browser tasks.\n\nSend me a message or upload a screenshot to get started.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !pendingImage) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      image: pendingImage || undefined,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const imageData = pendingImage;
    setPendingImage(null);
    setIsTyping(true);

    try {
      // Build history from last 10 messages (skip welcome)
      const recent = messages.slice(-10);
      const history = recent
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "user" ? "user" as const : "model" as const,
          text: m.content,
        }));

      // Strip data URL prefix for base64 if present
      let base64Image: string | undefined;
      if (imageData) {
        base64Image = imageData.includes(",") ? imageData.split(",")[1] : imageData;
      }

      const res = await fetch("/api/mods/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "Analyze this screenshot",
          image: base64Image,
          history,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      if (data.demo && !demoMode) {
        setDemoMode(true);
      }

      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMsg}\n\nPlease check that the Gemini API key is configured and try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, reply]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Demo mode banner */}
      {demoMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Demo mode — <code className="text-[10px] bg-amber-500/10 px-1 rounded">GOOGLE_GENAI_API_KEY</code> is not configured. Responses are limited.
          </span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                msg.role === "assistant"
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-muted border border-border"
              )}
            >
              {msg.role === "assistant" ? (
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "assistant"
                  ? "bg-muted/50 border border-border"
                  : "bg-amber-500/10 border border-amber-500/20 text-foreground"
              )}
            >
              {msg.image && (
                <img
                  src={msg.image}
                  alt="Uploaded"
                  className="rounded-lg mb-2 max-h-48 w-auto border border-border"
                />
              )}
              <div className="whitespace-pre-wrap [&_strong]:font-semibold [&_strong]:text-foreground">
                {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                  part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={i}>{part.slice(2, -2)}</strong>
                  ) : part.startsWith("`") && part.endsWith("`") ? (
                    <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
              <span className="block mt-1 text-[10px] text-muted-foreground/60">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <div className="relative inline-block">
            <img src={pendingImage} alt="Pending" className="h-16 rounded-lg border border-border" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 bg-card/80">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-amber-400"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Gemini..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/30 max-h-32"
            style={{ minHeight: "36px" }}
          />
          <Button
            size="icon"
            className="shrink-0 h-9 w-9 bg-amber-500/80 hover:bg-amber-500 text-black"
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || isTyping}
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
