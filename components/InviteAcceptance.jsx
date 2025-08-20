import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Users, Clock } from "lucide-react";
import { getPendingInvites, acceptInvite, declineInvite } from "../lib/database.js";

export default function InviteAcceptance({ onInviteAccepted, onClose }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadInvites = async () => {
    try {
      const pendingInvites = await getPendingInvites();
      setInvites(pendingInvites);
    } catch (error) {
      console.error("Failed to load invites:", error);
      setError("Failed to load invites");
    }
  };

  useEffect(() => {
    loadInvites();
  }, []);

  const handleAccept = async (inviteCode, gameId) => {
    setLoading(true);
    setError("");
    
    try {
      const result = await acceptInvite(inviteCode);
      if (result.success) {
        await loadInvites(); // Refresh invites
        if (onInviteAccepted) {
          onInviteAccepted(result.game_id);
        }
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError("Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async (inviteId) => {
    try {
      await declineInvite(inviteId);
      await loadInvites(); // Refresh invites
    } catch (error) {
      setError("Failed to decline invite");
    }
  };

  if (invites.length === 0) {
    return null; // Don't show anything if no invites
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Game Invitations ({invites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
          
          {invites.map((invite) => (
            <Card key={invite.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold text-lg">{invite.games.name}</div>
                    <div className="text-sm text-slate-600">
                      Season {invite.games.season} • {invite.games.currency}{invite.games.fine_amount} per late
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      From: {invite.invited_by_profile?.email}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleAccept(invite.invite_code, invite.game_id)}
                      disabled={loading}
                      className="flex-1 gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleDecline(invite.id)}
                      disabled={loading}
                      className="flex-1 gap-2"
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <div className="flex justify-center pt-2">
            <Button variant="ghost" onClick={onClose} className="text-sm">
              I'll decide later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}