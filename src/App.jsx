import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PiggyBank, Trophy, RefreshCcw, Plus, Trash2, Clock, Settings } from "lucide-react";

// ---- Helpers ----
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString();

const STORAGE_KEY = "late-fine-tracker:v1";

// ---- Types (for clarity) ----
// Player: { id, name }
// Event: { id, playerId, dateISO, reason, amount }

export default function App() {
  const [players, setPlayers] = useState([]); // [{id, name}]
  const [events, setEvents] = useState([]); // [{id, playerId, dateISO, reason, amount}]
  const [fineAmount, setFineAmount] = useState(10);
  const [currency, setCurrency] = useState("RM");
  const [season, setSeason] = useState("S1");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [reason, setReason] = useState("");

  // ---- Persistence ----
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPlayers(parsed.players || []);
        setEvents(parsed.events || []);
        setFineAmount(parsed.fineAmount ?? 10);
        setCurrency(parsed.currency || "RM");
        setSeason(parsed.season || "S1");
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ players, events, fineAmount, currency, season })
    );
  }, [players, events, fineAmount, currency, season]);

  // ---- Derived Data ----
  const totalsByPlayer = useMemo(() => {
    const map = new Map();
    players.forEach((p) => map.set(p.id, { ...p, lateCount: 0, amount: 0 }));
    events.forEach((e) => {
      const t = map.get(e.playerId);
      if (t) {
        t.lateCount += 1;
        t.amount += e.amount;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [players, events]);

  const totalPool = useMemo(() => events.reduce((sum, e) => sum + e.amount, 0), [events]);

  const streaks = useMemo(() => {
    // Simple streaks: consecutive days with zero lates per player (gamification: "On-time Streak")
    const byPlayerDates = new Map();
    events.forEach((e) => {
      const d = new Date(e.dateISO).toDateString();
      const arr = byPlayerDates.get(e.playerId) || new Set();
      arr.add(d);
      byPlayerDates.set(e.playerId, arr);
    });
    const result = new Map();
    players.forEach((p) => {
      // Count days since last late
      const set = byPlayerDates.get(p.id) || new Set();
      let days = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (set.has(d.toDateString())) break; // streak ended on this day
        days++;
      }
      result.set(p.id, days);
    });
    return result; // Map<playerId, days>
  }, [players, events]);

  // Chart data
  const chartData = useMemo(
    () => totalsByPlayer.map((p) => ({ name: p.name, total: p.amount })),
    [totalsByPlayer]
  );

  // ---- Actions ----
  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    setPlayers((prev) => [...prev, { id: uid(), name }]);
    setNewPlayerName("");
  };

  const removePlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setEvents((prev) => prev.filter((e) => e.playerId !== id));
  };

  const markLate = (playerId) => {
    setEvents((prev) => [
      { id: uid(), playerId, dateISO: todayISO(), reason: reason.trim() || "Late", amount: fineAmount },
      ...prev,
    ]);
    setReason("");
  };

  const resetSeason = () => {
    setEvents([]);
    setSeason((s) => {
      const num = parseInt(s.replace(/\D/g, "")) || 1;
      return `S${num + 1}`;
    });
  };

  const clearAll = () => {
    setPlayers([]);
    setEvents([]);
    setSeason("S1");
  };

  const seedDemo = () => {
    const a = { id: uid(), name: "You" };
    const b = { id: uid(), name: "Friend" };
    const demoEvents = [
      { id: uid(), playerId: a.id, dateISO: todayISO(), reason: "Traffic", amount: fineAmount },
      { id: uid(), playerId: b.id, dateISO: todayISO(), reason: "Overslept", amount: fineAmount },
      { id: uid(), playerId: b.id, dateISO: todayISO(), reason: "Coffee run", amount: fineAmount },
    ];
    setPlayers([a, b]);
    setEvents(demoEvents);
  };

  // ---- UI ----
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <PiggyBank className="h-7 w-7" /> Late Fine Tracker <span className="text-slate-400">{season}</span>
            </h1>
            <p className="text-sm text-slate-500">Gamified fines for late arrivals. Tap a name to add {currency}{fineAmount}.</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Settings className="h-4 w-4" /> Settings</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Game Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input id="currency" value={currency} onChange={(e)=>setCurrency(e.target.value.toUpperCase())} placeholder="RM" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Fine per late</Label>
                    <Input id="amount" type="number" value={fineAmount} onChange={(e)=>setFineAmount(Math.max(0, Number(e.target.value || 0)))} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={seedDemo}>Add demo data</Button>
                    <Button variant="destructive" onClick={clearAll} className="gap-2"><Trash2 className="h-4 w-4" /> Reset all</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={resetSeason} className="gap-2"><RefreshCcw className="h-4 w-4" /> New Season</Button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Pool</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{currency}{totalPool.toFixed(2)}</CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Top Contributor</CardTitle>
            </CardHeader>
            <CardContent>
              {totalsByPlayer[0] ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    <div className="font-semibold">{totalsByPlayer[0].name}</div>
                  </div>
                  <div className="text-xl font-bold">{currency}{totalsByPlayer[0].amount.toFixed(2)}</div>
                </div>
              ) : (
                <div className="text-slate-400">No data yet</div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Players</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{players.length}</CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="play" className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="play">Play</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          {/* Play Tab */}
          <TabsContent value="play" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Add Player */}
              <Card className="rounded-2xl shadow-sm md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">Add Player</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Player name"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    />
                    <Button onClick={addPlayer} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                  <div className="text-xs text-slate-500">Tip: add all friends first, then use the big buttons to mark late.</div>
                </CardContent>
              </Card>

              {/* Reason + Quick Mark */}
              <Card className="rounded-2xl shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Mark Someone Late</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-4 gap-2">
                    <div className="md:col-span-3">
                      <Input placeholder="Reason (optional)" value={reason} onChange={(e)=>setReason(e.target.value)} />
                    </div>
                    <div className="md:col-span-1">
                      <Input type="number" value={fineAmount} onChange={(e)=>setFineAmount(Math.max(0, Number(e.target.value || 0)))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {players.length === 0 && (
                      <div className="text-sm text-slate-400">No players yet. Add some on the left.</div>
                    )}
                    <AnimatePresence>
                      {players.map((p) => (
                        <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          <Button className="w-full h-12 rounded-xl text-base font-semibold" onClick={() => markLate(p.id)}>
                            {p.name}
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="rounded-2xl shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-2">#</th>
                          <th>Name</th>
                          <th>Late</th>
                          <th>Contributed</th>
                          <th>Streak</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {totalsByPlayer.map((p, i) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="py-2">{i + 1}</td>
                            <td className="font-medium">{p.name}</td>
                            <td>{p.lateCount}</td>
                            <td>{currency}{p.amount.toFixed(2)}</td>
                            <td>
                              <Badge variant={streaks.get(p.id) >= 7 ? "default" : "secondary"}>
                                {streaks.get(p.id)} day{streaks.get(p.id) === 1 ? "" : "s"}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => removePlayer(p.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {totalsByPlayer.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400">No players yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Contributions Chart</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(v)=>`${currency}${Number(v).toFixed(2)}`} />
                      <Bar dataKey="total" radius={[8,8,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">All Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">When</th>
                        <th>Who</th>
                        <th>Reason</th>
                        <th>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => {
                        const p = players.find((x) => x.id === e.playerId);
                        return (
                          <tr key={e.id} className="border-t border-slate-100">
                            <td className="py-2">{new Date(e.dateISO).toLocaleString()}</td>
                            <td className="font-medium">{p ? p.name : "(deleted)"}</td>
                            <td className="max-w-[30ch] truncate" title={e.reason}>{e.reason}</td>
                            <td>{currency}{e.amount.toFixed(2)}</td>
                            <td className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => setEvents((prev)=>prev.filter((x)=>x.id!==e.id))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {events.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">No events yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          Built for friendly bets. Data is stored locally in your browser.
        </div>
      </div>
    </div>
  );
}