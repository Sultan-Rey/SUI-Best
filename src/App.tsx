import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { TikTokPost } from "./components/TikTokPost";
import { LeaderboardPage } from "./components/LeaderboardPage";
import { UploadPage } from "./components/UploadPage";
import { BottomNav } from "./components/BottomNav";
import { ExclusivePage } from "./components/ExclusivePage";
import { UserProfilePage } from "./components/UserProfilePage";
import { ChatDMPage } from "./components/ChatDMPage";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [showChat, setShowChat] = useState(false);

  const posts = [
    {
      id: 1,
      artistName: "Sophie Martin",
      location: "École des Beaux-Arts, Paris, Sculpture",
      videoThumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=1000&fit=crop",
      likes: 1245,
      comments: 89,
      saves: 234
    },
    {
      id: 2,
      artistName: "Lucas Dubois",
      location: "Sorbonne University, Paris, Digital Art",
      videoThumbnail: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=600&h=1000&fit=crop",
      likes: 987,
      comments: 56,
      saves: 178
    },
    {
      id: 3,
      artistName: "Emma Laurent",
      location: "Royal Academy of Arts, London, Photography",
      videoThumbnail: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=1000&fit=crop",
      likes: 1567,
      comments: 92,
      saves: 312
    }
  ];

  const leaderboard = [
    {
      id: 1,
      rank: 1,
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
      name: "Sophie Martin",
      votes: 15420
    },
    {
      id: 2,
      rank: 2,
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
      name: "Lucas Dubois",
      votes: 12890
    },
    {
      id: 3,
      rank: 3,
      photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
      name: "Emma Laurent",
      votes: 11245
    },
    {
      id: 4,
      rank: 4,
      photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop",
      name: "Thomas Bernard",
      votes: 9876
    },
    {
      id: 5,
      rank: 5,
      photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop",
      name: "Julie Moreau",
      votes: 8543
    }
  ];

  return (
    
    <div className="h-screen overflow-hidden bg-black">
      {activeTab === "home" && !showChat && <TopBar />}
      
      {/* Home Feed */}
      {activeTab === "home" && (
  <>
    {showChat ? (
      <ChatDMPage onBack={() => setShowChat(false)} />
    ) : (
      <div className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
        {posts.map((post) => (
          <TikTokPost 
            key={post.id} 
            post={post}
            onChatClick={() => setShowChat(true)}
          />
        ))}
      </div>
    )}
  </>
)}

       

      {/* Leaderboard Page */}
      {activeTab === "ranking" && (
        <LeaderboardPage leaderboard={leaderboard} />
      )}

      {/* Upload Page */}
      {activeTab === "upload" && (
        <UploadPage />
      )}

      {/* Exclusive Content Page */}
      {activeTab === "exclusive" && (
        <ExclusivePage />
      )}

      {activeTab === "exclusive" && (
        <div className="h-full flex items-center justify-center bg-white">
          <h2 style={{ color: '#000055' }}>Exclusive Content</h2>
        </div>
      )}

      {activeTab === "profile" && (
        <UserProfilePage />
      )}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
