import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Trophy } from "lucide-react";

interface LeaderboardItem {
  id: number;
  rank: number;
  photo: string;
  name: string;
  votes: number;
}

interface LeaderboardSectionProps {
  leaderboard: LeaderboardItem[];
}

export function LeaderboardSection({ leaderboard }: LeaderboardSectionProps) {
  return (
    <div>
      {/* Leaderboard List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {leaderboard.map((artist) => (
          <div key={artist.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
            {/* Rank */}
            <div className="w-8 text-center">
              <span className="text-lg" style={{ color: artist.rank <= 3 ? '#ff7f00' : '#000055' }}>
                #{artist.rank}
              </span>
            </div>

            {/* Artist Photo */}
            <ImageWithFallback
              src={artist.photo}
              alt={artist.name}
              className="w-12 h-12 rounded-full object-cover"
            />

            {/* Artist Info */}
            <div className="flex-1">
              <p style={{ color: '#000055' }}>{artist.name}</p>
              <p className="text-sm text-gray-600">Votes: {artist.votes.toLocaleString()}</p>
            </div>

            {/* Trophy Icon for Top 3 */}
            {artist.rank <= 3 && (
              <Trophy className="w-5 h-5" style={{ color: '#ff7f00' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
