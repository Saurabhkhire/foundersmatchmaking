"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";
import { apiFetch } from "@/lib/api";

type Match = {
  id: string;
  score: number;
  aiReason: string;
  aiQuestions: string[];
  counterpart: { companyName: string; username: string; role: string };
};

type MatchPayload = {
  bestFounderMatch: Match | null;
  bestInvestorMatch: Match | null;
  founderMatches: Match[];
  investorMatches: Match[];
};

const INDUSTRY_OPTIONS = [
  "EdTech",
  "FinTech",
  "HealthTech",
  "AI",
  "SaaS",
  "Marketplace",
  "E-commerce",
  "ClimateTech",
  "Cybersecurity",
  "Consumer",
  "Gaming",
  "Other",
];

const STAGE_OPTIONS = [
  "Idea",
  "Pre-seed",
  "Seed",
  "Pre-series A",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Bootstrapped",
];

const MONEY_BANDS = [
  "Not raised",
  "1k to 10k",
  "10k to 50k",
  "50k to 100k",
  "100k to 500k",
  "500k to 1m",
  "1m to 5m",
  "5m to 10m",
  "10m to 50m",
  "50m to 100m",
  "100m+",
];

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <select
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Normalize API profile to string-only form state (fixes number coercion while typing). */
function normalizeProfileRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (k === "embedding" || k === "extractedData") continue;
    if (v === null || v === undefined) out[k] = "";
    else out[k] = String(v);
  }
  return out;
}

function MatchCard({ title, match }: { title: string; match: Match | null }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">{title}</h2>
      {match ? (
        <div className="mt-3 space-y-2 text-sm">
          <p><span className="font-semibold">{match.counterpart.companyName}</span> ({match.counterpart.username})</p>
          <p>Score: <span className="font-bold text-green-400">{match.score}/100</span></p>
          <p>{match.aiReason}</p>
          <ul className="list-disc pl-5 text-slate-300">
            {(match.aiQuestions || []).slice(0, 3).map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      ) : <p className="mt-3 text-sm text-slate-400">No qualified match yet.</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<MatchPayload | null>(null);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [role, setRole] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pauseMatchPoll, setPauseMatchPoll] = useState(false);
  const pitchRef = useRef<HTMLTextAreaElement>(null);

  function updateProfileField(key: string, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function loadMatches() {
    const res = await apiFetch("/matches");
    if (res.ok) {
      setData(await res.json());
    } else if (res.status === 401) {
      router.push("/login");
    }
  }

  async function loadProfile() {
    const res = await apiFetch("/profile");
    if (!res.ok) {
      if (res.status === 401) router.push("/login");
      return;
    }
    const payload = await res.json();
    setRole(payload.user.role);
    const raw =
      payload.user.role === "founder"
        ? payload.user.founderProfile
        : payload.user.investorProfile;
    setProfile(normalizeProfileRow((raw || {}) as Record<string, unknown>));
  }

  function buildSaveBody(): Record<string, string | number> {
    if (role === "founder") {
      const team = profile.teamSize?.trim() ?? "";
      const users = profile.usersCount?.trim() ?? "";
      return {
        ...profile,
        teamSize: team === "" ? 0 : Number(team) || 0,
        usersCount: users === "" ? 0 : Number(users) || 0,
      };
    }
    return { ...profile };
  }

  async function saveProfile() {
    setSaveStatus("");
    const res = await apiFetch("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSaveBody()),
    });
    if (res.ok) {
      setSaveStatus("Profile saved.");
      await loadProfile();
    } else if (res.status === 401) {
      setSaveStatus("Session expired. Please login again.");
      router.push("/login");
    } else {
      const err = await res.json().catch(() => ({}));
      setSaveStatus(err.error || "Failed to save profile.");
    }
  }

  async function generatePitch() {
    setPitchLoading(true);
    setSaveStatus("");
    const res = await apiFetch("/profile/generate-pitch", {
      method: "POST",
      body: JSON.stringify(buildSaveBody()),
    });
    if (res.ok) {
      const payload = await res.json();
      updateProfileField("pitch", payload.pitch || "");
      setSaveStatus("3-minute pitch generated. You can edit it before saving.");
    } else {
      setSaveStatus("Failed to generate pitch.");
    }
    setPitchLoading(false);
  }

  useEffect(() => {
    loadMatches();
    loadProfile();
  }, []);

  useEffect(() => {
    if (pauseMatchPoll) return;
    const interval = setInterval(() => loadMatches(), 20000);
    return () => clearInterval(interval);
  }, [pauseMatchPoll]);

  useEffect(() => {
    const el = pitchRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 224)}px`;
  }, [profile.pitch]);

  if (!data) return <main className="p-6">Loading matches...</main>;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Your AI matches</h1>
      <Card
        className="space-y-5"
        onFocusCapture={() => setPauseMatchPoll(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setPauseMatchPoll(false);
          }
        }}
      >
        <h2 className="text-lg font-semibold">Your Profile Inputs</h2>
        {role === "admin" ? (
          <p className="text-slate-300">Admins manage users and matching on the <Link className="text-blue-400 underline" href="/admin">Admin</Link> page.</p>
        ) : null}
        {role === "founder" ? (
          <div className="space-y-5">
            <AutoGrowTextarea
              label="LinkedIn URL"
              value={profile.linkedinUrl ?? ""}
              onChange={(v) => updateProfileField("linkedinUrl", v)}
              placeholder="https://www.linkedin.com/in/your-profile"
              minRows={2}
            />
            <AutoGrowTextarea
              label="Startup one-liner"
              value={profile.startupOneLiner ?? ""}
              onChange={(v) => updateProfileField("startupOneLiner", v)}
              placeholder="What do you build?"
              minRows={3}
            />
            <SelectField
              label="Industry type"
              value={profile.industryType ?? ""}
              onChange={(v) => updateProfileField("industryType", v)}
              options={INDUSTRY_OPTIONS}
            />
            <AutoGrowTextarea
              label="ICP"
              value={profile.icp ?? ""}
              onChange={(v) => updateProfileField("icp", v)}
              placeholder="Who is your ideal customer?"
              minRows={3}
            />
            <AutoGrowTextarea
              label="GTM"
              value={profile.gtm ?? ""}
              onChange={(v) => updateProfileField("gtm", v)}
              placeholder="How do you acquire customers?"
              minRows={3}
            />
            <AutoGrowTextarea
              label="Biggest bottleneck"
              value={profile.biggestBottleneck ?? ""}
              onChange={(v) => updateProfileField("biggestBottleneck", v)}
              placeholder="What is slowing growth?"
              minRows={3}
            />
            <AutoGrowTextarea
              label="Looking for"
              value={profile.lookingFor ?? ""}
              onChange={(v) => updateProfileField("lookingFor", v)}
              placeholder="What support do you need?"
              minRows={3}
            />
            <AutoGrowTextarea
              label="Can help with"
              value={profile.canHelp ?? ""}
              onChange={(v) => updateProfileField("canHelp", v)}
              placeholder="What can you offer others?"
              minRows={3}
            />
            <SelectField
              label="Stage"
              value={profile.stage ?? ""}
              onChange={(v) => updateProfileField("stage", v)}
              options={STAGE_OPTIONS}
            />
            <SelectField
              label="Revenue"
              value={profile.revenue ?? ""}
              onChange={(v) => updateProfileField("revenue", v)}
              options={MONEY_BANDS}
            />
            <SelectField
              label="Money raised"
              value={profile.moneyRaised ?? ""}
              onChange={(v) => updateProfileField("moneyRaised", v)}
              options={MONEY_BANDS}
            />
            <AutoGrowTextarea
              label="Team size"
              value={profile.teamSize ?? ""}
              onChange={(v) => updateProfileField("teamSize", v)}
              placeholder="Number of people on the team"
              minRows={2}
            />
            <AutoGrowTextarea
              label="Users count"
              value={profile.usersCount ?? ""}
              onChange={(v) => updateProfileField("usersCount", v)}
              placeholder="Active users or customers"
              minRows={2}
            />
          </div>
        ) : role === "investor" ? (
          <div className="space-y-5">
            <AutoGrowTextarea
              label="LinkedIn URL"
              value={profile.linkedinUrl ?? ""}
              onChange={(v) => updateProfileField("linkedinUrl", v)}
              placeholder="https://www.linkedin.com/in/your-profile"
              minRows={2}
            />
            <AutoGrowTextarea
              label="Preferred sector"
              value={profile.preferredSector ?? ""}
              onChange={(v) => updateProfileField("preferredSector", v)}
              minRows={3}
            />
            <AutoGrowTextarea
              label="Preferred stage"
              value={profile.preferredStage ?? ""}
              onChange={(v) => updateProfileField("preferredStage", v)}
              minRows={3}
            />
            <AutoGrowTextarea
              label="Traction expectation"
              value={profile.tractionExpectation ?? ""}
              onChange={(v) => updateProfileField("tractionExpectation", v)}
              minRows={3}
            />
            <AutoGrowTextarea
              label="Investment interest"
              value={profile.investmentInterest ?? ""}
              onChange={(v) => updateProfileField("investmentInterest", v)}
              minRows={3}
            />
            <AutoGrowTextarea
              label="Red flags"
              value={profile.redFlags ?? ""}
              onChange={(v) => updateProfileField("redFlags", v)}
              minRows={3}
            />
            <AutoGrowTextarea
              label="User preference"
              value={profile.usersPreference ?? ""}
              onChange={(v) => updateProfileField("usersPreference", v)}
              minRows={3}
            />
          </div>
        ) : null}

        {role === "founder" || role === "investor" ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Your Editable 3-Minute Pitch</label>
              <textarea
                ref={pitchRef}
                className="min-h-56 w-full resize-y rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-base leading-6 text-slate-100 placeholder:text-slate-500"
                placeholder="Generate pitch or write your own pitch here..."
                value={profile.pitch ?? ""}
                onChange={(e) => updateProfileField("pitch", e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={generatePitch} disabled={pitchLoading}>
                {pitchLoading ? "Generating pitch..." : "Generate 3-Minute Pitch"}
              </Button>
              <Button type="button" onClick={saveProfile}>Save Profile</Button>
            </div>
            {saveStatus ? <p className="text-sm text-slate-300">{saveStatus}</p> : null}
          </>
        ) : null}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <MatchCard title="Best Founder Match" match={data.bestFounderMatch} />
        <MatchCard title="Best Investor Match" match={data.bestInvestorMatch} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">All Founder Matches</h2>
          <div className="space-y-2 text-sm">{data.founderMatches.map((m) => <p key={m.id}>{m.counterpart.companyName} - {m.score}/100</p>)}</div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">All Investor Matches</h2>
          <div className="space-y-2 text-sm">{data.investorMatches.map((m) => <p key={m.id}>{m.counterpart.companyName} - {m.score}/100</p>)}</div>
        </Card>
      </div>
    </main>
  );
}
