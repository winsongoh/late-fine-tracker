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
import { PiggyBank, Trophy, RefreshCcw, Plus, Trash2, Clock, Settings, ArrowLeft } from "lucide-react";
import { 
  addPlayer, 
  addEvent, 
  deletePlayer, 
  deleteEvent, 
  getGameData, 
  resetSeason, 
  updateGame,
  getUserGames,
  createGame,
  subscribeToGameChanges,
  getCurrentUser,
  acceptInvite
} from "../lib/database.js";
import InviteDialog from "./InviteDialog.jsx";
import InviteAcceptance from "./InviteAcceptance.jsx";

// Game Selection Component
function GameSelector({ games, onSelectGame, onCreateGame }) {
  const [newGameName, setNewGameName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGame = async () => {
    if (!newGameName.trim()) return;
    
    setIsCreating(true);
    try {
      const game = await createGame(newGameName.trim());
      onCreateGame(game);
      setNewGameName("");
    } catch (error) {
      console.error("Failed to create game:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-2 mb-2">
            <PiggyBank className="h-8 w-8" /> Late Fine Tracker
          </h1>
          <p className="text-slate-600">Select a game or create a new one</p>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Game</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Game name"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGame()}
              />
              <Button onClick={handleCreateGame} disabled={isCreating} className="gap-2">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Games</CardTitle>
          </CardHeader>
          <CardContent>
            {games.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No games yet. Create your first game above!</p>
            ) : (
              <div className="space-y-2">
                {games.map((game) => (
                  <Button
                    key={game.id}
                    variant="outline"
                    className="w-full justify-between h-auto p-4"
                    onClick={() => onSelectGame(game)}
                  >
                    <div className="text-left">
                      <div className="font-semibold">{game.name}</div>
                      <div className="text-sm text-slate-500">
                        {game.season} • {game.currency}{game.fine_amount} per late
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(game.updated_at).toLocaleDateString()}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main Game Component
export default function LateFineTrackerSupabase() {
  const [currentGame, setCurrentGame] = useState(null);
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [reason, setReason] = useState("");
  const [fineAmount, setFineAmount] = useState(10);
  const [showInviteAcceptance, setShowInviteAcceptance] = useState(false);

  // Load user's games on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      
      // Check for invite code in URL
      const urlParams = new URLSearchParams(window.location.search);
      const inviteCode = urlParams.get('invite');
      if (inviteCode) {
        try {
          const result = await acceptInvite(inviteCode);
          if (result.success) {
            // Clear the invite from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Load games and select the invited game
            const userGames = await getUserGames();
            setGames(userGames);
            const invitedGame = userGames.find(g => g.id === result.game_id);
            if (invitedGame) {
              setCurrentGame(invitedGame);
            }
          }
        } catch (error) {
          console.error("Failed to accept invite from URL:", error);
        }
      } else {
        await loadGames();
        setShowInviteAcceptance(true); // Show pending invites
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load game data when a game is selected
  useEffect(() => {
    if (currentGame) {
      loadGameData();
      
      // Subscribe to real-time changes
      const unsubscribe = subscribeToGameChanges(currentGame.id, () => {
        loadGameData();
      });
      
      return unsubscribe;
    }
  }, [currentGame]);

  const loadGames = async () => {
    try {
      const userGames = await getUserGames();
      setGames(userGames);
    } catch (error) {
      console.error("Failed to load games:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadGameData = async () => {
    if (!currentGame) return;
    
    try {
      const { game, players: gamePlayers, events: gameEvents } = await getGameData(currentGame.id);
      setCurrentGame(game);
      setPlayers(gamePlayers);
      setEvents(gameEvents);
      setFineAmount(game.fine_amount);
    } catch (error) {
      console.error("Failed to load game data:", error);
    }
  };

  const handleSelectGame = (game) => {
    setCurrentGame(game);
  };

  const handleCreateGame = (newGame) => {
    setGames(prev => [newGame, ...prev]);
    setCurrentGame(newGame);
  };

  const handleBackToGames = () => {
    setCurrentGame(null);
    setPlayers([]);
    setEvents([]);
  };

  // ---- Derived Data ----
  const totalsByPlayer = useMemo(() => {
    const map = new Map();
    players.forEach((p) => map.set(p.id, { ...p, lateCount: 0, amount: 0 }));
    events.forEach((e) => {
      const t = map.get(e.player_id);
      if (t) {
        t.lateCount += 1;
        t.amount += e.amount;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [players, events]);

  const totalPool = useMemo(() => events.reduce((sum, e) => sum + e.amount, 0), [events]);

  const streaks = useMemo(() => {
    const byPlayerDates = new Map();
    events.forEach((e) => {
      const d = new Date(e.date_iso).toDateString();
      const arr = byPlayerDates.get(e.player_id) || new Set();
      arr.add(d);
      byPlayerDates.set(e.player_id, arr);
    });
    const result = new Map();
    players.forEach((p) => {
      const set = byPlayerDates.get(p.id) || new Set();
      let days = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (set.has(d.toDateString())) break;
        days++;
      }
      result.set(p.id, days);
    });
    return result;
  }, [players, events]);

  const chartData = useMemo(
    () => totalsByPlayer.map((p) => ({ name: p.name, total: p.amount })),
    [totalsByPlayer]
  );

  // ---- Actions ----
  const addPlayerAction = async () => {
    const name = newPlayerName.trim();
    if (!name || !currentGame) return;
    
    try {
      await addPlayer(currentGame.id, name);
      setNewPlayerName("");
      loadGameData();
    } catch (error) {
      console.error("Failed to add player:", error);
    }
  };

  const removePlayerAction = async (playerId) => {
    try {
      await deletePlayer(playerId);
      loadGameData();
    } catch (error) {
      console.error("Failed to remove player:", error);
    }
  };

  const markLate = async (playerId) => {
    if (!currentGame) return;
    
    try {
      await addEvent(currentGame.id, playerId, reason.trim() || "Late", fineAmount);
      setReason("");
      loadGameData();
    } catch (error) {
      console.error("Failed to mark late:", error);
    }
  };

  const resetSeasonAction = async () => {
    if (!currentGame) return;
    
    try {
      await resetSeason(currentGame.id);
      loadGameData();
    } catch (error) {
      console.error("Failed to reset season:", error);
    }
  };

  const updateGameSettings = async (settings) => {
    if (!currentGame) return;
    
    try {
      await updateGame(currentGame.id, settings);
      loadGameData();
    } catch (error) {
      console.error("Failed to update game:", error);
    }
  };

  const removeEvent = async (eventId) => {
    try {
      await deleteEvent(eventId);
      loadGameData();
    } catch (error) {
      console.error("Failed to remove event:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!currentGame) {
    return (
      <GameSelector 
        games={games} 
        onSelectGame={handleSelectGame} 
        onCreateGame={handleCreateGame}
      />
    );
  }

  // ---- Main Game UI ----
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleBackToGames} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <PiggyBank className="h-7 w-7" /> {currentGame.name} <span className="text-slate-400">{currentGame.season}</span>
              </h1>
              <p className="text-sm text-slate-500">Tap a name to add {currentGame.currency}{currentGame.fine_amount}.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InviteDialog game={currentGame} currentUserId={currentUser?.id} />
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
                    <Input 
                      id="currency" 
                      value={currentGame.currency} 
                      onChange={(e) => updateGameSettings({ currency: e.target.value.toUpperCase() })}
                      placeholder="RM" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Fine per late</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      value={currentGame.fine_amount} 
                      onChange={(e) => updateGameSettings({ fine_amount: Math.max(0, Number(e.target.value || 0)) })}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={resetSeasonAction} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> New Season
            </Button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Pool</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{currentGame.currency}{totalPool.toFixed(2)}</CardContent>
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
                  <div className="text-xl font-bold">{currentGame.currency}{totalsByPlayer[0].amount.toFixed(2)}</div>
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
                      onKeyDown={(e) => e.key === "Enter" && addPlayerAction()}
                    />
                    <Button onClick={addPlayerAction} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
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
                      <Input 
                        type="number" 
                        value={fineAmount} 
                        onChange={(e)=>setFineAmount(Math.max(0, Number(e.target.value || 0)))} 
                      />
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
                            <td>{currentGame.currency}{p.amount.toFixed(2)}</td>
                            <td>
                              <Badge variant={streaks.get(p.id) >= 7 ? "default" : "secondary"}>
                                {streaks.get(p.id)} day{streaks.get(p.id) === 1 ? "" : "s"}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => removePlayerAction(p.id)}>
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
                      <Tooltip formatter={(v)=>`${currentGame.currency}${Number(v).toFixed(2)}`} />
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
                        const player = players.find((p) => p.id === e.player_id);
                        return (
                          <tr key={e.id} className="border-t border-slate-100">
                            <td className="py-2">{new Date(e.date_iso).toLocaleString()}</td>
                            <td className="font-medium">{player ? player.name : "(deleted)"}</td>
                            <td className="max-w-[30ch] truncate" title={e.reason}>{e.reason}</td>
                            <td>{currentGame.currency}{e.amount.toFixed(2)}</td>
                            <td className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => removeEvent(e.id)}>
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
          Built for friendly bets. Data is synced to the cloud.
        </div>
      </div>

      {/* Invite Acceptance Modal */}
      {showInviteAcceptance && (
        <InviteAcceptance 
          onInviteAccepted={(gameId) => {
            setShowInviteAcceptance(false);
            loadGames().then(() => {
              const acceptedGame = games.find(g => g.id === gameId);
              if (acceptedGame) {
                setCurrentGame(acceptedGame);
              }
            });
          }}
          onClose={() => setShowInviteAcceptance(false)}
        />
      )}
    </div>
  );
}