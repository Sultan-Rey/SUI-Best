import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Star, Play } from "lucide-react";

interface FeaturedArtistCardProps {
  artist: {
    id: number;
    photo: string;
    name: string;
    votes: number;
    category: string;
  };
  rank: number;
  showDonations?: boolean;
}

export function FeaturedArtistCard({ artist, rank, showDonations = false }: FeaturedArtistCardProps) {
  return (
    <div className="min-w-[280px] sm:min-w-[320px] lg:min-w-[380px] group cursor-pointer flex-shrink-0">
      <div className="relative aspect-[16/9] rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-105">
        <ImageWithFallback
          src={artist.photo}
          alt={artist.name}
          className="w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        
        {/* Rank Badge */}
        <div
          className="absolute top-3 left-3 px-3 py-1 rounded-full flex items-center gap-1"
          style={{ backgroundColor: rank <= 3 ? "#ff7f00" : "rgba(0, 0, 0, 0.8)" }}
        >
          <span className="text-white">#{rank}</span>
          {rank <= 3 && <Star className="w-4 h-4 text-white" fill="white" />}
        </div>

        {/* Hover Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-6 h-6 text-white" fill="white" />
          </div>
        </div>

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform">
          <h3 className="text-white text-lg mb-1">{artist.name}</h3>
          <p className="text-gray-300 text-sm mb-2">{artist.category}</p>
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              {showDonations ? "€" : ""}
              {artist.votes.toLocaleString()}{" "}
              {showDonations ? "dons" : "votes"}
            </p>
            <button
              className="px-4 py-1 rounded text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: "#ff7f00" }}
            >
              Voir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
