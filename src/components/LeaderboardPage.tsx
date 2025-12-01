import { useState, useRef } from "react";
import { Trophy, TrendingUp, DollarSign, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { ArtistCard } from "./ArtistCard";
import { FeaturedArtistCard } from "./FeaturedArtistCard";

interface LeaderboardItem {
  id: number;
  rank: number;
  photo: string;
  name: string;
  votes: number;
}

interface LeaderboardPageProps {
  leaderboard: LeaderboardItem[];
}

export function LeaderboardPage({ leaderboard }: LeaderboardPageProps) {
  const [activeFilter, setActiveFilter] = useState("top-votes");
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const featuredScrollRef = useRef<HTMLDivElement>(null);

  const filters = [
    { id: "top-votes", label: "Top Votes", icon: Trophy },
    { id: "top-donations", label: "Top Dons", icon: DollarSign },
    { id: "trending", label: "Tendance", icon: TrendingUp },
    { id: "new", label: "Nouveaux", icon: Clock }
  ];

  // Mock data for different categories
  const topVotesArtists = [
    {
      id: 1,
      photo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=400&fit=crop",
      name: "Sophie Martin",
      votes: 15420,
      category: "Sculpture"
    },
    {
      id: 2,
      photo: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=300&h=400&fit=crop",
      name: "Lucas Dubois",
      votes: 12890,
      category: "Digital Art"
    },
    {
      id: 3,
      photo: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=300&h=400&fit=crop",
      name: "Emma Laurent",
      votes: 11245,
      category: "Photography"
    },
    {
      id: 4,
      photo: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=300&h=400&fit=crop",
      name: "Thomas Bernard",
      votes: 9876,
      category: "Painting"
    },
    {
      id: 5,
      photo: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=300&h=400&fit=crop",
      name: "Julie Moreau",
      votes: 8543,
      category: "Mixed Media"
    },
    {
      id: 6,
      photo: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=400&fit=crop",
      name: "Marc Petit",
      votes: 7621,
      category: "Music"
    }
  ];

  const topDonationsArtists = [
    {
      id: 7,
      photo: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=400&fit=crop",
      name: "Claire Fontaine",
      votes: 25000,
      category: "Contemporary Art"
    },
    {
      id: 8,
      photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=400&fit=crop",
      name: "Pierre Durand",
      votes: 18500,
      category: "Installation"
    },
    {
      id: 9,
      photo: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=400&fit=crop",
      name: "Marie Blanc",
      votes: 15200,
      category: "Performance Art"
    },
    {
      id: 10,
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop",
      name: "Jean Rousseau",
      votes: 12800,
      category: "Street Art"
    },
    {
      id: 11,
      photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=400&fit=crop",
      name: "Léa Girard",
      votes: 11400,
      category: "Illustration"
    },
    {
      id: 12,
      photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=400&fit=crop",
      name: "Antoine Martin",
      votes: 9800,
      category: "Graphic Design"
    }
  ];

  const trendingArtists = [
    {
      id: 13,
      photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop",
      name: "Camille Dubois",
      votes: 8920,
      category: "3D Art"
    },
    {
      id: 14,
      photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=400&fit=crop",
      name: "Hugo Lefebvre",
      votes: 8456,
      category: "Animation"
    },
    {
      id: 15,
      photo: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=300&h=400&fit=crop",
      name: "Sarah Cohen",
      votes: 7890,
      category: "Fashion Design"
    },
    {
      id: 16,
      photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop",
      name: "Nicolas Roux",
      votes: 7234,
      category: "Architecture"
    },
    {
      id: 17,
      photo: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=300&h=400&fit=crop",
      name: "Isabelle Moreau",
      votes: 6987,
      category: "Textile Art"
    },
    {
      id: 18,
      photo: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=300&h=400&fit=crop",
      name: "Maxime Petit",
      votes: 6543,
      category: "Video Art"
    }
  ];

  const newArtists = [
    {
      id: 19,
      photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=400&fit=crop",
      name: "Lucie Bernard",
      votes: 1234,
      category: "Ceramics"
    },
    {
      id: 20,
      photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=400&fit=crop",
      name: "Vincent Laurent",
      votes: 987,
      category: "Calligraphy"
    },
    {
      id: 21,
      photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=400&fit=crop",
      name: "Chloé Dumas",
      votes: 876,
      category: "Jewelry Design"
    },
    {
      id: 22,
      photo: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=300&h=400&fit=crop",
      name: "Alex Mercier",
      votes: 765,
      category: "Collage"
    },
    {
      id: 23,
      photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=400&fit=crop",
      name: "Manon Garnier",
      votes: 654,
      category: "Printmaking"
    },
    {
      id: 24,
      photo: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=300&h=400&fit=crop",
      name: "Julien Robert",
      votes: 543,
      category: "Woodworking"
    }
  ];

  const getArtistsForFilter = () => {
    switch (activeFilter) {
      case "top-votes":
        return topVotesArtists;
      case "top-donations":
        return topDonationsArtists;
      case "trending":
        return trendingArtists;
      case "new":
        return newArtists;
      default:
        return topVotesArtists;
    }
  };

  const currentArtists = getArtistsForFilter();
  const featuredArtists = currentArtists.slice(0, 6);

  const scrollFeatured = (direction: "left" | "right") => {
    if (featuredScrollRef.current) {
      const scrollAmount = featuredScrollRef.current.offsetWidth * 0.8;
      featuredScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const scrollFilters = (direction: "left" | "right") => {
    if (filterScrollRef.current) {
      const scrollAmount = 200;
      filterScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="max-w-full px-4 sm:px-6 lg:px-12 py-6 pb-24">
        {/* Hero Header */}
        <div className="mb-8 pt-4">
          <h1 className="text-white text-4xl mb-2">Classement des Artistes</h1>
          <p className="text-gray-400">Découvrez les talents qui font vibrer notre communauté</p>
        </div>

        {/* Filter Tabs Slider */}
        <div className="mb-8 relative group/filters">
          <div 
            ref={filterScrollRef}
            className="overflow-x-auto scrollbar-hide"
          >
            <div className="flex gap-4 pb-2 min-w-max">
              {filters.map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg whitespace-nowrap transition-all ${
                      activeFilter === filter.id
                        ? "text-white border-2"
                        : "bg-gray-800/50 text-gray-300 hover:bg-gray-800 border-2 border-transparent"
                    }`}
                    style={
                      activeFilter === filter.id
                        ? { backgroundColor: "#ff7f00", borderColor: "#ff7f00" }
                        : {}
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Filter Navigation Arrows */}
          <button
            onClick={() => scrollFilters("left")}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-black/80 hover:bg-black items-center justify-center transition-all opacity-0 group-hover/filters:opacity-100 z-10"
            style={{ backgroundColor: "rgba(0, 0, 85, 0.9)" }}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => scrollFilters("right")}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-black/80 hover:bg-black items-center justify-center transition-all opacity-0 group-hover/filters:opacity-100 z-10"
            style={{ backgroundColor: "rgba(0, 0, 85, 0.9)" }}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Featured Top Artists Netflix-style Slider */}
        {featuredArtists.length > 0 && (
          <div className="mb-12">
            <h2 className="text-white text-2xl mb-4">Top {featuredArtists.length}</h2>
            <div className="relative group/featured">
              <div
                ref={featuredScrollRef}
                className="overflow-x-auto scrollbar-hide"
              >
                <div className="flex gap-4 pb-4">
                  {featuredArtists.map((artist, index) => (
                    <FeaturedArtistCard
                      key={artist.id}
                      artist={artist}
                      rank={index + 1}
                      showDonations={activeFilter === "top-donations"}
                    />
                  ))}
                </div>
              </div>
              
              {/* Navigation Arrows */}
              <button
                onClick={() => scrollFeatured("left")}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-12 h-12 rounded-full bg-black/80 hover:bg-black items-center justify-center transition-all opacity-0 group-hover/featured:opacity-100 z-10"
                style={{ backgroundColor: "rgba(0, 0, 85, 0.9)" }}
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => scrollFeatured("right")}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 w-12 h-12 rounded-full bg-black/80 hover:bg-black items-center justify-center transition-all opacity-0 group-hover/featured:opacity-100 z-10"
                style={{ backgroundColor: "rgba(0, 0, 85, 0.9)" }}
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Artists Grid */}
        <div>
          <h3 className="text-white text-2xl mb-4">Tous les artistes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {currentArtists.map((artist, index) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                rank={index + 1}
                showDonations={activeFilter === "top-donations"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
