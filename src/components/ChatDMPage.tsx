import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, MoreVertical, Image, Mic, Smile, Camera, Heart, CheckCheck, Check } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "artist";
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  type?: "text" | "image";
  imageUrl?: string;
}
interface ChatDMPageProps {
  onBack: () => void;
}

export  function ChatDMPage({onBack}: ChatDMPageProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Salut ! J'adore vraiment ton travail 🎨",
      sender: "user",
      timestamp: "14:23",
      status: "read"
    },
    {
      id: 2,
      text: "Merci beaucoup ! Ça me fait vraiment plaisir 😊",
      sender: "artist",
      timestamp: "14:25"
    },
    {
      id: 3,
      text: "Ta dernière sculpture est incroyable ! Comment as-tu eu l'inspiration ?",
      sender: "user",
      timestamp: "14:26",
      status: "read"
    },
    {
      id: 4,
      text: "C'est venu en observant les formes naturelles dans un parc. La nature est ma plus grande source d'inspiration.",
      sender: "artist",
      timestamp: "14:28"
    },
    {
      id: 5,
      text: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop",
      sender: "artist",
      timestamp: "14:28",
      type: "image",
      imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop"
    },
    {
      id: 6,
      text: "Voici une photo de mon processus de création",
      sender: "artist",
      timestamp: "14:29"
    },
    {
      id: 7,
      text: "Wow ! C'est fascinant de voir les coulisses ❤️",
      sender: "user",
      timestamp: "14:30",
      status: "delivered"
    }
  ]);
  
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const artistInfo = {
    name: "Sophie Martin",
    photo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop",
    isOnline: true,
    isVerified: true
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: messages.length + 1,
        text: inputText,
        sender: "user",
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        status: "sent"
      };
      setMessages([...messages, newMessage]);
      setInputText("");
      
      // Simulate artist typing
      setTimeout(() => setIsTyping(true), 1000);
      setTimeout(() => {
        setIsTyping(false);
        // Simulate artist response
        const response: Message = {
          id: messages.length + 2,
          text: "Merci pour ton message ! 😊",
          sender: "artist",
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, response]);
      }, 3000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button 
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center -ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-700">
            <img 
              src={artistInfo.photo} 
              alt={artistInfo.name}
              className="w-full h-full object-cover"
            />
          </div>
          {artistInfo.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-1">
            <h2 className="text-white font-semibold text-base">{artistInfo.name}</h2>
            {artistInfo.isVerified && (
              <div className="w-4 h-4 bg-blue-500  chat-dm-page rounded-full flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {isTyping ? "En train d'écrire..." : artistInfo.isOnline ? "En ligne" : "Hors ligne"}
          </p>
        </div>

        <button className="w-9 h-9 flex items-center justify-center">
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.sender === "artist" && (
              <div className="w-8 h-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                <img 
                  src={artistInfo.photo} 
                  alt={artistInfo.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className={`max-w-[75%] ${message.sender === "user" ? "items-end" : "items-start"} flex flex-col`}>
              {message.type === "image" && message.imageUrl ? (
                <div className="rounded-2xl overflow-hidden mb-1">
                  <img 
                    src={message.imageUrl} 
                    alt="Shared image"
                    className="max-w-full h-auto"
                  />
                </div>
              ) : (
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    message.sender === "user"
                      ? "rounded-br-sm"
                      : "bg-gray-800 rounded-bl-sm"
                  }`}
                  style={message.sender === "user" ? { backgroundColor: "#ff7f00" } : {}}
                >
                  <p className="text-white text-sm leading-relaxed">{message.text}</p>
                </div>
              )}
              
              <div className={`flex items-center gap-1 mt-1 px-1 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <span className="text-xs text-gray-500">{message.timestamp}</span>
                {message.sender === "user" && message.status && (
                  <div className="flex items-center">
                    {message.status === "sent" && <Check className="w-3 h-3 text-gray-500" />}
                    {message.status === "delivered" && <CheckCheck className="w-3.5 h-3.5 text-gray-500" />}
                    {message.status === "read" && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
              <img 
                src={artistInfo.photo} 
                alt={artistInfo.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gradient-to-t from-gray-900 to-black border-t border-gray-800 px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Attachment buttons */}
          <button className="w-9 h-9 flex items-center justify-center text-gray-400 active:text-white transition-colors">
            <Image className="w-5 h-5" />
          </button>
          
          {/* Input field */}
          <div className="flex-1 bg-gray-800 rounded-full px-4 py-2.5 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
            />
            <button className="text-gray-400 active:text-white transition-colors">
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Send button */}
          {inputText.trim() ? (
            <button 
              onClick={handleSend}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{ backgroundColor: "#ff7f00" }}
            >
              <Send className="w-5 h-5 text-white" fill="white" />
            </button>
          ) : (
            <button className="w-9 h-9 flex items-center justify-center text-gray-400 active:text-white transition-colors">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Quick reactions */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
          <button className="px-3 py-1.5 bg-gray-800 rounded-full text-xs text-gray-300 whitespace-nowrap active:bg-gray-700 transition-colors">
            👍 Cool !
          </button>
          <button className="px-3 py-1.5 bg-gray-800 rounded-full text-xs text-gray-300 whitespace-nowrap active:bg-gray-700 transition-colors">
            ❤️ J'adore
          </button>
          <button className="px-3 py-1.5 bg-gray-800 rounded-full text-xs text-gray-300 whitespace-nowrap active:bg-gray-700 transition-colors">
            🔥 Incroyable
          </button>
          <button className="px-3 py-1.5 bg-gray-800 rounded-full text-xs text-gray-300 whitespace-nowrap active:bg-gray-700 transition-colors">
            👏 Bravo
          </button>
          <button className="px-3 py-1.5 bg-gray-800 rounded-full text-xs text-gray-300 whitespace-nowrap active:bg-gray-700 transition-colors">
            🎨 Créatif
          </button>
        </div>
      </div>


      <style>{`

       .chat-dm-page {
    background-color: #3b82f6 !important;
  }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        
        .animate-bounce {
          animation: bounce 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}