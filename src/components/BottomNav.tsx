import { Home, Trophy, PlusCircle, Circle, User } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "ranking", icon: Trophy, label: "Ranking" },
    { id: "upload", icon: PlusCircle, label: "Upload" },
    { id: "exclusive", icon: Circle, label: "Exclusive" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 z-50">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center gap-1 px-4 py-2 min-w-0 transition-colors hover:bg-white/10 rounded-lg"
            >
              <Icon
                className="w-6 h-6"
                style={{ color: isActive ? "#ff7f00" : "white" }}
              />
              <span
                className="text-xs"
                style={{ color: isActive ? "#ff7f00" : "white" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
