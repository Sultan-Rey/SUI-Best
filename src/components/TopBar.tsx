import { Search, Bell, X } from "lucide-react";
import { useState } from "react";

export function TopBar() {
  const [showAd, setShowAd] = useState(true);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 mt-3">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-2">
        {/* Row avec Search et Notification (inchangé) */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white" />
            <input
              type="text"
              placeholder="Search Artists, Schools, Categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-sm text-white placeholder-white/70"
            />
          </div>

          <div className="relative">
            <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <Bell className="w-6 h-6 text-white" />
              <span
                className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: "#ff7f00" }}
              ></span>
            </button>
          </div>
        </div>

        {/* Bannière publicitaire AVEC BOUTON CLOSE */}
      {showAd && (
          <div className="relative w-full h-16 rounded-lg overflow-hidden shadow-lg">
            <img
              src="https://img.freepik.com/psd-gratuit/projet-modele-groupe-musique_23-2151630023.jpg"
              alt="Advertisement"
              className="w-full h-full object-cover"
            />
            
            {/* ⬅️ Ajout de la classe z-10 pour garantir la visibilité */}
            <div className="absolute top-1 right-1 **z-10**"> 
              <button
                onClick={() => setShowAd(false)}
                className="p-1 **bg-black/70** rounded-full hover:bg-black transition-colors"
              >
                <X className="w-5 h-5 **text-white**" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}