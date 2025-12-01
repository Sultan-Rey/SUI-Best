import { DeviceFrameset } from "react-device-frameset";

export function MobileViewport({ children }: { children: React.ReactNode }) {
 return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-900 p-4">
      <DeviceFrameset
        device="iPhone X"
        color="black"
        width={450}
        height={800}
      >
        {/* 👇 IMPORTANT : relative */}
        <div className="w-full h-full bg-black overflow-hidden relative">
          {children}
        </div>
      </DeviceFrameset>
    </div>
  );
}
