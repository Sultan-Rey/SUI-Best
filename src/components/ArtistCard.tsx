import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Star } from "lucide-react";

interface ArtistCardProps {
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

export function ArtistCard({ artist, rank, showDonations = false }: ArtistCardProps) {
  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 transition-transform duration-300 group-hover:scale-105">
        <ImageWithFallback
          src={artist.photo}
          alt={artist.name}
          className="w-full h-full object-cover"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-sm mb-1">{artist.category}</p>
            <p className="text-gray-300 text-xs">
              {showDonations ? "€" : ""}
              {artist.votes.toLocaleString()} {showDonations ? "dons" : "votes"}
            </p>
          </div>
        </div>
        {/* Rank Badge */}
        <div
          className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: rank <= 3 ? "#ff7f00" : "rgba(0, 0, 0, 0.7)" }}
        >
          <span className="text-sm">#{rank}</span>
        </div>
        {/* Top 3 Star */}
        {rank <= 3 && (
          <div className="absolute top-2 right-2">
            <Star className="w-5 h-5" style={{ color: "#ff7f00" }} fill="#ff7f00" />
          </div>
        )}
      </div>
      <h4 className="text-white text-sm group-hover:text-opacity-80 transition-colors">
        {artist.name}
      </h4>
    </div>
  );
}
