"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function SetupPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace("/");
  }, [user, ready, router]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 py-10">
      <div className="max-w-xl mx-auto text-sm text-slate-400">
        Redirecting...
      </div>
    </div>
  );
}
