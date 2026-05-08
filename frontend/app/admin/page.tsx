"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type User = { id: string; username: string; companyName: string; role: string };

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  async function loadUsers() {
    const res = await apiFetch("/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    } else if (res.status === 401 || res.status === 403) {
      router.push("/login");
    }
  }

  async function deleteUser(id: string) {
    await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
    loadUsers();
  }

  async function deleteAllUsers() {
    const confirmed = window.confirm("Delete all non-admin users?");
    if (!confirmed) return;
    const res = await apiFetch("/admin/users", { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setStatus(`Deleted ${data.deletedCount ?? 0} users.`);
      loadUsers();
    }
  }

  async function runMatching() {
    setRunning(true);
    const res = await apiFetch("/admin/run-matching", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.email?.skipped) {
        setStatus(`Matching complete. Email skipped: ${data.email.reason}`);
      } else {
        const sr = data.email?.skippedRecipients ? ` (unsupported profiles skipped: ${data.email.skippedRecipients})` : "";
        setStatus(`Matching complete. Emails sent: ${data.email?.sent ?? 0}, failed: ${data.email?.failed ?? 0}.${sr}`);
      }
    } else {
      const err = await res.json().catch(() => ({}));
      setStatus(`Matching failed: ${(err && err.error) || res.statusText}`);
    }
    setRunning(false);
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadUsers();
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Admin Control</h1>
      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">Matching Engine</h2>
        <Button onClick={runMatching} disabled={running}>{running ? "Running..." : "Run Matching"}</Button>
        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-semibold">Users</h2>
        <div className="mb-4">
          <Button variant="outline" onClick={deleteAllUsers}>Delete All Users (Non-admin)</Button>
        </div>
        <div className="space-y-3 text-sm">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded border border-slate-800 p-3">
              <div>{u.companyName} ({u.username}) - {u.role}</div>
              <Button variant="outline" onClick={() => deleteUser(u.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
