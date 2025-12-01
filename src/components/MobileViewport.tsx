export function MobileViewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-900">
      <div
        className="relative overflow-hidden"
        style={{
          width: "393px",     // Galaxy Note 22 viewport approximatif
          height: "873px",
          borderRadius: "40px",
          border: "8px solid #000",
          background: "#000",
        }}
      >
        {/* Screen WITHOUT padding (critical) */}
        <div className="absolute inset-0">
          {children}
        </div>
      </div>
    </div>
  );
}
