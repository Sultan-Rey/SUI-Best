import { Heart, MessageCircle, Star, MoreVertical, Play } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface PostCardProps {
  post: {
    id: number;
    artistName: string;
    location: string;
    videoThumbnail: string;
    likes: number;
    comments: number;
    topComments: Array<{
      avatar: string;
      text: string;
    }>;
  };
  isStacked?: boolean;
}

export function PostCard({ post, isStacked = false }: PostCardProps) {
  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden shadow-lg">
      {/* Video Player */}
      <div className="relative aspect-[4/3] bg-gray-200">
        {!isStacked && (
          <>
            <ImageWithFallback
              src={post.videoThumbnail}
              alt={post.artistName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-16 h-16 rounded-full border-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 flex items-center justify-center transition-all" style={{ borderColor: '#000055' }}>
                <Play className="w-8 h-8 ml-1" style={{ color: '#000055' }} />
              </button>
            </div>
          </>
        )}
        {isStacked && (
          <div className="w-full h-full bg-gray-300"></div>
        )}
      </div>

      <div className="p-4 bg-white">
        {/* Artist Info */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="mb-1" style={{ color: '#000055' }}>Artist Name</h3>
              <p className="text-sm text-gray-500">Location (School, City, Faculty...)</p>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <MoreVertical className="w-5 h-5" style={{ color: '#000055' }} />
            </button>
          </div>
        </div>

        {/* Social Interaction Bar */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <Heart className="w-5 h-5" style={{ color: '#000055' }} />
              <span className="text-sm" style={{ color: '#000055' }}>Like</span>
            </button>
            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <MessageCircle className="w-5 h-5" style={{ color: '#000055' }} />
              <span className="text-sm" style={{ color: '#000055' }}>Comment +</span>
            </button>
            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <Star className="w-5 h-5" style={{ color: '#000055' }} />
              <span className="text-sm" style={{ color: '#000055' }}>Favorites / Save</span>
            </button>
          </div>
        </div>

        {/* Social Interaction Bar Label */}
        <div className="mb-3">
          <p className="text-sm text-gray-600 mb-2">Social Interaction Bar</p>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0"></div>
            <div>
              <p className="text-xs text-gray-500">CommentName</p>
              <p className="text-sm text-gray-600">Mini-preview of recent comments</p>
            </div>
          </div>
        </div>

        {/* Vote CTA */}
        <button
          className="w-full py-2.5 rounded border-2 transition-all hover:opacity-90"
          style={{ borderColor: '#000055', color: '#000055', backgroundColor: 'white' }}
        >
          Vote for this Artist
        </button>
      </div>
    </div>
  );
}
