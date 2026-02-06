"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { fixtures } from "@/data/fixtures";
import { players } from "@/data/players";

export default function SignupPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [country, setCountry] = useState("");
  const [stateName, setStateName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");

  const teamOptions = useMemo(() => {
    const unique = new Set<string>();
    fixtures.forEach(match => {
      match.teams.forEach(team => unique.add(team));
    });
    return Array.from(unique)
      .filter(team => team && team.toLowerCase() !== "tbc")
      .sort();
  }, []);

  const countryOptions = useMemo(() => {
    const unique = new Set<string>();
    players.forEach(player => unique.add(player.country));
    return Array.from(unique).sort();
  }, []);

  const STATE_OPTIONS: Record<string, string[]> = {
    India: [
      "Andhra Pradesh",
      "Arunachal Pradesh",
      "Assam",
      "Bihar",
      "Chhattisgarh",
      "Goa",
      "Gujarat",
      "Haryana",
      "Himachal Pradesh",
      "Jharkhand",
      "Karnataka",
      "Kerala",
      "Madhya Pradesh",
      "Maharashtra",
      "Manipur",
      "Meghalaya",
      "Mizoram",
      "Nagaland",
      "Odisha",
      "Punjab",
      "Rajasthan",
      "Sikkim",
      "Tamil Nadu",
      "Telangana",
      "Tripura",
      "Uttar Pradesh",
      "Uttarakhand",
      "West Bengal",
      "Delhi",
      "Jammu & Kashmir",
      "Ladakh",
      "Puducherry",
    ],
    "United States of America": [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "Florida",
      "Georgia",
      "Hawaii",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Michigan",
      "Minnesota",
      "Mississippi",
      "Missouri",
      "Montana",
      "Nebraska",
      "Nevada",
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
      "North Carolina",
      "North Dakota",
      "Ohio",
      "Oklahoma",
      "Oregon",
      "Pennsylvania",
      "Rhode Island",
      "South Carolina",
      "South Dakota",
      "Tennessee",
      "Texas",
      "Utah",
      "Vermont",
      "Virginia",
      "Washington",
      "West Virginia",
      "Wisconsin",
      "Wyoming",
    ],
    USA: [
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "Florida",
      "Georgia",
      "Hawaii",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Michigan",
      "Minnesota",
      "Mississippi",
      "Missouri",
      "Montana",
      "Nebraska",
      "Nevada",
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
      "North Carolina",
      "North Dakota",
      "Ohio",
      "Oklahoma",
      "Oregon",
      "Pennsylvania",
      "Rhode Island",
      "South Carolina",
      "South Dakota",
      "Tennessee",
      "Texas",
      "Utah",
      "Vermont",
      "Virginia",
      "Washington",
      "West Virginia",
      "Wisconsin",
      "Wyoming",
    ],
    "United Arab Emirates": [
      "Abu Dhabi",
      "Dubai",
      "Sharjah",
      "Ajman",
      "Umm Al Quwain",
      "Ras Al Khaimah",
      "Fujairah",
    ],
    UAE: [
      "Abu Dhabi",
      "Dubai",
      "Sharjah",
      "Ajman",
      "Umm Al Quwain",
      "Ras Al Khaimah",
      "Fujairah",
    ],
  };

  const stateOptions = useMemo(() => {
    if (!country) return [];
    return STATE_OPTIONS[country] ?? ["Not applicable"];
  }, [country]);

  useEffect(() => {
    if (!country) {
      setStateName("");
      return;
    }
    if (!stateOptions.length) {
      setStateName("");
      return;
    }
    if (!stateOptions.includes(stateName)) {
      setStateName(stateOptions[0] ?? "");
    }
  }, [country, stateOptions, stateName]);

  useEffect(() => {
    if (!ready) return;
    if (user) router.replace("/");
  }, [user, ready, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (
      !email ||
      !password ||
      !fullName ||
      !teamName ||
      !contactNumber ||
      !country ||
      !stateName ||
      !favoriteTeam
    ) {
      setMessage("Please fill all details to create your account.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          team_name: teamName,
          contact_number: contactNumber,
          country,
          state: stateName,
          favorite_team: favoriteTeam,
        },
      },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created. Check your email to confirm.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 py-8">
      <div className="max-w-sm mx-auto space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-indigo-300/70">
            Fantasy Cricket Season
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Create your team.
          </h1>
          <p className="text-[13px] text-slate-400 leading-relaxed">
            Set up once to join leagues and compete all season.
          </p>
        </div>

        <div className="border border-white/10 bg-white/5 rounded-3xl p-6 space-y-4 shadow-[0_0_36px_rgba(79,70,229,0.12)] backdrop-blur">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Create account</h2>
            <p className="text-xs text-slate-300">
              Fill all details to register.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs text-slate-300">
              Email
              <input
                type="email"
                autoComplete="off"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Full Name
              <input
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Team Name
              <input
                value={teamName}
                onChange={event => setTeamName(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Contact Number
              <input
                value={contactNumber}
                onChange={event => setContactNumber(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs text-slate-300">
                Country
                <select
                  value={country}
                  onChange={event => setCountry(event.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                >
                  <option value="">Select country</option>
                  {countryOptions.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                State / Region
                <select
                  value={stateName}
                  onChange={event => setStateName(event.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                >
                  <option value="">Select state</option>
                  {stateOptions.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-300">
              Favorite Team
              <select
                value={favoriteTeam}
                onChange={event => setFavoriteTeam(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              >
                <option value="">Select team</option>
                {teamOptions.map(team => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Working..." : "Create account"}
            </button>
          </form>

          {message && (
            <div className="text-xs text-slate-300 border border-white/10 rounded-lg px-3 py-2">
              {message}
            </div>
          )}

          <div className="text-xs text-slate-300">
            Already have an account?{" "}
            <a href="/login" className="text-indigo-300 hover:underline">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
