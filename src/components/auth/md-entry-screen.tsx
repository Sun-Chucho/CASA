"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * A deliberately minimal, touch-friendly MD entry point.  It establishes the
 * same director session consumed by the existing dashboard, without asking
 * for credentials or changing any dashboard data.
 */
export function MdEntryScreen() {
  const router = useRouter();

  const enterDashboard = () => {
    localStorage.setItem("orange-hotel-role", "director");
    router.push("/dashboard");
  };

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-white p-6">
      <button
        type="button"
        onClick={enterDashboard}
        aria-label="Open Managing Director dashboard"
        className="flex min-h-44 min-w-44 items-center justify-center rounded-3xl p-4 outline-none transition-transform duration-200 focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 sm:min-h-52 sm:min-w-52"
      >
        <Image
          src="/logo.png"
          alt="CASSA Hotel"
          width={192}
          height={192}
          priority
          className="h-auto w-40 object-contain sm:w-48"
        />
      </button>
    </main>
  );
}
