import { MessageSquareDashedIcon, MessageCircle, Star, Share2, Play, Gift } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface TikTokPostProps {
  post: {
    id: number;
    artistName: string;
    location: string;
    videoThumbnail: string;
    likes: number;
    comments: number;
    saves: number;
  };
   onChatClick: () => void;
}

export function TikTokPost({ post, onChatClick }: TikTokPostProps) {
  return (
    <div className="relative h-screen w-full snap-start snap-always">
      {/* Video Background */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={post.videoThumbnail}
          alt={post.artistName}
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>
      </div>

      {/* Play Button Center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <button className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center pointer-events-auto hover:bg-white/30 transition-all">
          <Play className="w-10 h-10 ml-2 text-white" fill="white" />
        </button>
      </div>

      {/* Bottom Left - Artist Info */}
      <div className="absolute bottom-24 left-0 right-20 px-4 text-white z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gray-400 border-2 border-white"></div>
          <div className="flex-1">
            <h3 className="mb-1">{post.artistName}</h3>
            <p className="text-sm opacity-90">{post.location}</p>
          </div>
        </div>
        
        {/* Vote CTA Button */}
        <button
          className="w-full py-3 rounded-lg text-white transition-opacity hover:opacity-90 mt-3"
          style={{ backgroundColor: '#ff7f00' }}
        >
          Vote for this Artist
        </button>
      </div>

      {/* Right Side - Action Buttons */}
      <div className="absolute bottom-24 right-4 flex flex-col items-center gap-6 z-10">
        {/* Like */}
        <button className="flex flex-col items-center gap-1 hover:scale-110 transition-transform">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Gift className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs">{post.likes}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1 hover:scale-110 transition-transform">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs">{post.comments}</span>
        </button>

        {/* Save/Favorite */}
        <button className="flex flex-col items-center gap-1 hover:scale-110 transition-transform">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Star className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs">{post.saves}</span>
        </button>
        {/* Chat */}
         <button 
        onClick={onChatClick}
        className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
      >
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <MessageSquareDashedIcon className="w-7 h-7 text-white" />
        </div>
        <span className="text-white text-xs">DM</span>
      </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-1 hover:scale-110 transition-transform">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs">Share</span>
        </button>
      </div>
    </div>
  );
}