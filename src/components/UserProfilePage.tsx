import { useState, useRef } from "react";
import { Heart, Star, Users, TrendingUp, MapPin, Calendar, Link2, Instagram, Twitter, Edit, Share2, ChevronLeft, ChevronRight, Play, MessageCircle, MoreVertical, CheckCircle } from "lucide-react";

interface Post {
  id: number;
  type: "image" | "video";
  thumbnail: string;
  likes: number;
  comments: number;
}

interface Achievement {
  id: number;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export  function UserProfilePage() {
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  
  // User data
  const userData = {
    photo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=400&fit=crop",
    coverPhoto: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=300&fit=crop",
    name: "Sophie Martin",
    username: "@sophiemartin",
    bio: "Sculptrice passionnée 🎨 | Créatrice d'art contemporain",
    location: "Paris, France",
    website: "sophiemartin-art.com",
    joinDate: "Janvier 2024",
    fans: "15.4K",
    votes: "12.8K",
    stars: "342",
    posts: "156",
    following: "234",
    isVerified: true,
    isPremium: true
  };

  // Posts data
  const userPosts: Post[] = [
    {
      id: 1,
      type: "image",
      thumbnail: "https://images.unsplash.com/photo-1578926314433-e2789279f4aa?w=400&h=400&fit=crop",
      likes: 2345,
      comments: 128
    },
    {
      id: 2,
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop",
      likes: 3456,
      comments: 234
    },
    {
      id: 3,
      type: "image",
      thumbnail: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=400&h=400&fit=crop",
      likes: 1890,
      comments: 95
    },
    {
      id: 4,
      type: "image",
      thumbnail: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop",
      likes: 4567,
      comments: 312
    },
    {
      id: 5,
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=400&fit=crop",
      likes: 2890,
      comments: 167
    },
    {
      id: 6,
      type: "image",
      thumbnail: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=400&fit=crop",
      likes: 3210,
      comments: 189
    },
    {
      id: 7,
      type: "image",
      thumbnail: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=400&h=400&fit=crop",
      likes: 1567,
      comments: 78
    },
    {
      id: 8,
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400&h=400&fit=crop",
      likes: 5432,
      comments: 423
    },
    {
      id: 9,
      type: "image",
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
      likes: 2103,
      comments: 156
    }
  ];

  // Achievements
  const achievements: Achievement[] = [
    {
      id: 1,
      icon: "🏆",
      title: "Top Artiste",
      description: "Plus de 10K fans",
      unlocked: true
    },
    {
      id: 2,
      icon: "⭐",
      title: "Étoile Montante",
      description: "300+ stars gagnées",
      unlocked: true
    },
    {
      id: 3,
      icon: "🎨",
      title: "Créateur Prolifique",
      description: "100+ posts publiés",
      unlocked: true
    },
    {
      id: 4,
      icon: "💎",
      title: "Membre Premium",
      description: "Abonnement actif",
      unlocked: true
    },
    {
      id: 5,
      icon: "🔥",
      title: "Tendance",
      description: "Top 10 cette semaine",
      unlocked: true
    },
    {
      id: 6,
      icon: "👑",
      title: "Légende",
      description: "Top 3 du mois",
      unlocked: false
    }
  ];

  const tabs = [
    { id: "posts", label: "Posts" },
    { id: "achievements", label: "Succès" },
    { id: "about", label: "Info" }
  ];

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-black via-gray-900 to-black pb-24">
      {/* Cover Photo */}
      
      <div className="relative h-24">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
        
        {/* Top Actions */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <MoreVertical className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4">
        {/* Profile Photo & Quick Info */}
<div className="flex justify-center mt-6 mb-4">
  <div className="relative">

    {/* Photo en taille 24 + responsive */}
    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-black bg-gray-800 overflow-hidden">
      <img 
        src={userData.photo} 
        alt={userData.name}
        className="w-full h-full object-cover"
      />
    </div>

    {/* Badge premium */}
    {userData.isPremium && (
      <div className="absolute bottom-1 right-1 w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-black">
        <Star className="w-4 h-4 text-black" fill="gold" />
      </div>
    )}
  </div>
</div>



        {/* Name & Username */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-white text-xl font-bold">{userData.name}</h1>
            {userData.isVerified && (
              <CheckCircle className="w-5 h-5 text-blue-500" fill="#3b82f6" />
            )}
          </div>
          <p className="text-gray-400 text-sm">{userData.username}</p>
        </div>

        {/* Stats Row */}
        {/* Stats Row */}
<div className="flex justify-between text-center mb-4 px-2">
  <div className="flex-1">
    <p className="text-white text-lg font-bold">{userData.posts}</p>
    <p className="text-gray-400 text-xs">Posts</p>
  </div>

  <div className="flex-1">
    <p className="text-white text-lg font-bold">{userData.fans}</p>
    <p className="text-gray-400 text-xs">Fans</p>
  </div>

  <div className="flex-1">
    <p className="text-white text-lg font-bold">{userData.votes}</p>
    <p className="text-gray-400 text-xs">Votes</p>
  </div>

  <div className="flex-1">
    <p className="text-white text-lg font-bold">{userData.stars}</p>
    <p className="text-gray-400 text-xs">Stars</p>
  </div>
</div>


        {/* Bio */}
        <div className="mb-4">
          <p className="text-white text-sm leading-relaxed mb-3">{userData.bio}</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <MapPin className="w-3.5 h-3.5" style={{ color: "#ff7f00" }} />
              <span>{userData.location}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Link2 className="w-3.5 h-3.5" style={{ color: "#ff7f00" }} />
              <a href={`https://${userData.website}`} className="hover:text-white">
                {userData.website}
              </a>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Calendar className="w-3.5 h-3.5" style={{ color: "#ff7f00" }} />
              <span>Membre depuis {userData.joinDate}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setIsFollowing(!isFollowing)}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              isFollowing 
                ? "bg-gray-800 text-white" 
                : "text-white"
            }`}
            style={!isFollowing ? { backgroundColor: "#ff7f00" } : {}}
          >
            {isFollowing ? "Abonné" : "S'abonner"}
          </button>
          <button className="flex-1 py-2.5 rounded-lg font-semibold bg-gray-800 text-white text-sm">
            Message
          </button>
          <button className="w-11 py-2.5 rounded-lg bg-gray-800 flex items-center justify-center">
            <Edit className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 mb-4 -mx-4 px-4">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 font-semibold text-sm transition-all ${
                  activeTab === tab.id
                    ? "text-white border-b-2"
                    : "text-gray-400"
                }`}
                style={activeTab === tab.id ? { borderColor: "#ff7f00" } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "posts" && (
          <div className="grid grid-cols-3 gap-1">
            {userPosts.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square bg-gray-900 cursor-pointer group"
              >
                <img 
                  src={post.thumbnail} 
                  alt={`Post ${post.id}`}
                  className="w-full h-full object-cover"
                />
                {post.type === "video" && (
                  <div className="absolute top-2 right-2">
                    <Play className="w-4 h-4 text-white drop-shadow-lg" fill="white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-white text-xs font-semibold">
                    <Heart className="w-4 h-4" fill="white" />
                    <span>{(post.likes / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex items-center gap-1 text-white text-xs font-semibold">
                    <MessageCircle className="w-4 h-4" fill="white" />
                    <span>{post.comments}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`rounded-xl p-4 flex items-start gap-4 ${
                  achievement.unlocked
                    ? "bg-gradient-to-r from-gray-800 to-gray-900 border border-yellow-500/30"
                    : "bg-gray-800/30 border border-gray-800 opacity-60"
                }`}
              >
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-white font-bold text-sm">{achievement.title}</h4>
                    {achievement.unlocked && (
                      <Star className="w-3.5 h-3.5 text-yellow-500" fill="#eab308" />
                    )}
                  </div>
                  <p className="text-gray-400 text-xs">{achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-4">
            <div className="bg-gray-800/30 rounded-xl p-4">
              <h3 className="text-white text-base font-bold mb-3">À propos</h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-3">
                Artiste sculptrice basée à Paris, je crée des œuvres qui explorent la relation entre 
                la forme, l'espace et l'émotion humaine.
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Mes créations ont été exposées dans plusieurs galeries en France et à l'international.
              </p>
            </div>

            <div className="bg-gray-800/30 rounded-xl p-4">
              <h3 className="text-white text-base font-bold mb-3">Formation</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white font-semibold text-sm">École des Beaux-Arts</p>
                  <p className="text-gray-400 text-xs">Master Sculpture • 2018-2020</p>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Résidence d'Artiste</p>
                  <p className="text-gray-400 text-xs">Villa Médicis, Rome • 2021</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-xl p-4">
              <h3 className="text-white text-base font-bold mb-3">Expositions</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white font-semibold text-sm">Formes Vivantes</p>
                  <p className="text-gray-400 text-xs">Galerie Perrotin • 2024</p>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Matière & Émotion</p>
                  <p className="text-gray-400 text-xs">Centre Pompidou • 2023</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-xl p-4">
              <h3 className="text-white text-base font-bold mb-3">Réseaux sociaux</h3>
              <div className="flex gap-4">
                <a href="#" className="flex items-center gap-2 text-gray-300">
                  <Instagram className="w-5 h-5" />
                  <span className="text-sm">Instagram</span>
                </a>
                <a href="#" className="flex items-center gap-2 text-gray-300">
                  <Twitter className="w-5 h-5" />
                  <span className="text-sm">Twitter</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}