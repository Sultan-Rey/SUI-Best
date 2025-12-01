import { useState, useRef } from "react";
import { Lock, Video, Camera, Mic, Radio, Play, Clock, Eye, Star, Search } from "lucide-react";

interface ExclusiveContent {
  id: number;
  type: "video" | "behind-scenes" | "interview" | "live";
  thumbnail: string;
  title: string;
  artist: string;
  artistPhoto: string;
  duration: string;
  views: number;
  price: number;
  isPremium: boolean;
  isLive?: boolean;
  releaseDate: string;
}

export  function ExclusivePage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [userPremium] = useState(false);

  const filters = [
    { id: "all", label: "Tout", icon: Star },
    { id: "video", label: "Vidéos", icon: Video },
    { id: "behind-scenes", label: "Coulisses", icon: Camera },
    { id: "interview", label: "Interviews", icon: Mic },
    { id: "live", label: "Lives", icon: Radio }
  ];

  const exclusiveContent: ExclusiveContent[] = [
    {
      id: 1,
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=400&fit=crop",
      title: "Masterclass: Techniques de Sculpture Moderne",
      artist: "Sophie Martin",
      artistPhoto: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop",
      duration: "45:30",
      views: 2340,
      price: 15,
      isPremium: true,
      releaseDate: "2024-11-20"
    },
    {
      id: 2,
      type: "behind-scenes",
      thumbnail: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=400&fit=crop",
      title: "Dans l'Atelier de Emma Laurent",
      artist: "Emma Laurent",
      artistPhoto: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=100&h=100&fit=crop",
      duration: "28:15",
      views: 1890,
      price: 10,
      isPremium: false,
      releaseDate: "2024-11-22"
    },
    {
      id: 3,
      type: "interview",
      thumbnail: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=600&h=400&fit=crop",
      title: "Lucas Dubois: Le Futur de l'Art Digital",
      artist: "Lucas Dubois",
      artistPhoto: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=100&h=100&fit=crop",
      duration: "52:40",
      views: 3120,
      price: 12,
      isPremium: true,
      releaseDate: "2024-11-18"
    },
    {
      id: 4,
      type: "live",
      thumbnail: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=600&h=400&fit=crop",
      title: "Session Live: Peinture en Direct",
      artist: "Thomas Bernard",
      artistPhoto: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=100&h=100&fit=crop",
      duration: "LIVE",
      views: 892,
      price: 8,
      isPremium: false,
      isLive: true,
      releaseDate: "2024-11-29"
    },
    {
      id: 5,
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=600&h=400&fit=crop",
      title: "Exploration du Mixed Media",
      artist: "Julie Moreau",
      artistPhoto: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=100&h=100&fit=crop",
      duration: "38:20",
      views: 1567,
      price: 15,
      isPremium: true,
      releaseDate: "2024-11-25"
    },
    {
      id: 6,
      type: "behind-scenes",
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop",
      title: "Studio Session: Création Musicale",
      artist: "Marc Petit",
      artistPhoto: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop",
      duration: "41:15",
      views: 2890,
      price: 10,
      isPremium: false,
      releaseDate: "2024-11-21"
    },
    {
      id: 7,
      type: "interview",
      thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
      title: "Conversation: Art Contemporain",
      artist: "Claire Fontaine",
      artistPhoto: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop",
      duration: "1:05:30",
      views: 4230,
      price: 18,
      isPremium: true,
      releaseDate: "2024-11-15"
    },
    {
      id: 8,
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=400&fit=crop",
      title: "Techniques d'Installation Artistique",
      artist: "Pierre Durand",
      artistPhoto: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop",
      duration: "33:45",
      views: 1678,
      price: 12,
      isPremium: false,
      releaseDate: "2024-11-23"
    }
  ];

  const getContentForFilter = () => {
    if (activeFilter === "all") return exclusiveContent;
    return exclusiveContent.filter(content => content.type === activeFilter);
  };

  const currentContent = getContentForFilter();
  const featuredContent = currentContent.slice(0, 3);

  const ContentCard = ({ content, featured = false }: { content: ExclusiveContent; featured?: boolean }) => {
    const canAccess = userPremium || !content.isPremium;
    
    return (
      <div className={`relative rounded-xl overflow-hidden bg-gray-900 ${featured ? "" : "mb-3"}`}>
        {/* Thumbnail */}
        <div className={`relative ${featured ? "aspect-video" : "aspect-video"}`}>
          <img 
            src={content.thumbnail} 
            alt={content.title}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          {/* Live badge */}
          {content.isLive && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold">LIVE</span>
            </div>
          )}
          
          {/* Premium badge */}
          {content.isPremium && (
            <div className="absolute top-2 right-2 bg-yellow-500 px-2.5 py-1 rounded-full">
              <span className="text-black text-xs font-bold">PREMIUM</span>
            </div>
          )}
          
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-7 h-7 text-white ml-1" fill="white" />
            </div>
          </div>
          
          {/* Lock overlay */}
          {!canAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center">
                <Lock className="w-10 h-10 text-white mx-auto mb-2" />
                <p className="text-white font-bold text-base">{content.price}€</p>
              </div>
            </div>
          )}
          
          {/* Duration */}
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded">
            <div className="flex items-center gap-1">
              {!content.isLive && <Clock className="w-3 h-3 text-white" />}
              <span className="text-white text-xs font-semibold">{content.duration}</span>
            </div>
          </div>
        </div>
        
        {/* Info */}
        <div className="p-3">
          <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">{content.title}</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src={content.artistPhoto} 
                alt={content.artist}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="text-gray-300 text-xs">{content.artist}</span>
            </div>
            
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Eye className="w-3 h-3" />
              <span>{(content.views / 1000).toFixed(1)}k</span>
            </div>
          </div>
          
          {!canAccess && (
            <button 
              className="w-full mt-3 py-2 rounded-lg text-white font-semibold text-sm"
              style={{ backgroundColor: "#ff7f00" }}
            >
              Acheter {content.price}€
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-black via-gray-900 to-black pb-24">
      <div className="px-4 py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-white text-2xl font-bold mb-1">Exclusifs</h1>
          <p className="text-gray-400 text-sm">Contenus premium de vos artistes</p>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="bg-gray-800 rounded-full px-4 py-2.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un contenu..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
            />
          </div>
        </div>

        {/* Premium Banner */}
        {!userPremium && (
          <div className="mb-4 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600" />
            <div className="relative z-10">
              <h2 className="text-white text-lg font-bold mb-1">Premium 💎</h2>
              <p className="text-white/90 text-sm mb-3">Accès illimité pour 19,99€/mois</p>
              <button className="w-full py-2.5 bg-black text-white rounded-lg font-bold text-sm">
                S'abonner
              </button>
            </div>
          </div>
        )}

        {/* Filter Pills */}
        <div className="mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 pb-2">
            {filters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                    activeFilter === filter.id
                      ? "text-white"
                      : "bg-gray-800 text-gray-300"
                  }`}
                  style={activeFilter === filter.id ? { backgroundColor: "#ff7f00" } : {}}
                >
                  <Icon className="w-4 h-4" />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Section */}
    <div className="mb-5">
  <h2 className="text-white text-lg font-bold mb-3">À la Une</h2>
  <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
    {featuredContent.map((content) => (
      <div key={content.id} className="flex-none" style={{ minWidth: 'calc(100vw/1.5 - 2rem)' }}>
        <ContentCard content={content} featured={true} />
      </div>
    ))}
  </div>
</div>

        {/* All Content */}
        <div>
          <h2 className="text-white text-lg font-bold mb-3">Tous les contenus</h2>
          <div className="space-y-3">
            {currentContent.slice(3).map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}