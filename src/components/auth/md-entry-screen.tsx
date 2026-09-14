"use client";

/**
 * A deliberately minimal, touch-friendly MD entry point.  It establishes the
 * same director session consumed by the existing dashboard, without asking
 * for credentials or changing any dashboard data.
 */
export function MdEntryScreen() {
  const enterDashboard = () => {
    localStorage.setItem("orange-hotel-role", "director");
    // A full navigation makes the entry work consistently on mobile browsers
    // and installed PWAs, even if the client router has not hydrated yet.
    window.location.assign("/dashboard");
  };

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#0d1510] p-6">
      <button
        type="button"
        onClick={enterDashboard}
        aria-label="Open Managing Director dashboard"
        className="flex h-56 w-56 items-center justify-center rounded-[2rem] border border-white/20 bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] outline-none transition duration-200 hover:scale-[1.02] focus-visible:ring-4 focus-visible:ring-white/70 active:scale-95 sm:h-64 sm:w-64"
      >
        <img
          src="/logo.png"
          alt="CASSA Hotel"
          width={220}
          height={220}
          className="h-auto w-full object-contain"
        />
      </button>
    </main>
  );
}
