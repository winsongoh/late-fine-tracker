import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Copy, Trash2, Mail, Users, Clock, Check, X } from "lucide-react";
import { 
  createGameInvite, 
  getGameInvites, 
  getGameMembers, 
  cancelInvite, 
  removeGameMember 
} from "../lib/database.js";

export default function InviteDialog({ game, currentUserId }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);

  const loadData = async () => {
    if (!game || !open) return;
    
    try {
      const [invitesData, membersData] = await Promise.all([
        getGameInvites(game.id),
        getGameMembers(game.id)
      ]);
      setInvites(invitesData);
      setMembers(membersData);
    } catch (error) {
      console.error("Failed to load invite data:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [game, open]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const invite = await createGameInvite(game.id, inviteEmail);
      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      loadData(); // Refresh the lists
    } catch (error) {
      setError(error.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      await cancelInvite(inviteId);
      loadData();
    } catch (error) {
      setError("Failed to cancel invite");
    }
  };

  const handleRemoveMember = async (memberId, memberUserId) => {
    if (memberUserId === currentUserId) return; // Can't remove yourself
    
    try {
      await removeGameMember(game.id, memberUserId);
      loadData();
    } catch (error) {
      setError("Failed to remove member");
    }
  };

  const copyInviteLink = (inviteCode) => {
    const inviteUrl = `${window.location.origin}?invite=${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setSuccess("Invite link copied to clipboard!");
  };

  const generateAndCopyLink = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Create a generic invite (no specific email)
      const invite = await createGameInvite(game.id, "anonymous@invite.link");
      const inviteUrl = `${window.location.origin}?invite=${invite.invite_code}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(inviteUrl);
      setSuccess("Invite link generated and copied to clipboard!");
      
      // Refresh the lists to show the new invite
      loadData();
    } catch (error) {
      setError(error.message || "Failed to generate invite link");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (invite) => {
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (invite.status === 'accepted') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Accepted</Badge>;
    } else if (invite.status === 'declined') {
      return <Badge variant="secondary">Declined</Badge>;
    } else if (expiresAt < now) {
      return <Badge variant="destructive">Expired</Badge>;
    } else {
      return <Badge variant="outline">Pending</Badge>;
    }
  };

  const isOwner = game.created_by === currentUserId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" /> Invite Players
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Game Access - {game.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invite">Send Invite</TabsTrigger>
            <TabsTrigger value="pending">Pending ({invites.filter(i => i.status === 'pending' && new Date(i.expires_at) > new Date()).length})</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                {success}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send Email Invite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="space-y-3">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="friend@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    {loading ? "Sending..." : "Send Invite"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Quick Share Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Generate a shareable link that anyone can use to join this game
                  </p>
                  <Button 
                    onClick={generateAndCopyLink} 
                    disabled={loading}
                    variant="outline" 
                    className="w-full gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    {loading ? "Generating..." : "Generate & Copy Invite Link"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            {invites.filter(invite => {
              const now = new Date();
              const expiresAt = new Date(invite.expires_at);
              return invite.status === 'pending' || (invite.status !== 'accepted' && expiresAt > now);
            }).length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No pending invites
              </div>
            ) : (
              invites
                .filter(invite => {
                  const now = new Date();
                  const expiresAt = new Date(invite.expires_at);
                  return invite.status === 'pending' || (invite.status !== 'accepted' && expiresAt > now);
                })
                .map((invite) => (
                  <Card key={invite.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{invite.invited_email}</div>
                          <div className="text-sm text-slate-500 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Expires {new Date(invite.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(invite)}
                          {invite.status === 'pending' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => copyInviteLink(invite.invite_code)}
                                className="gap-1"
                              >
                                <Copy className="h-3 w-3" />
                                Copy Link
                              </Button>
                              {isOwner && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleCancelInvite(invite.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {member.auth_users?.email || 'Unknown User'}
                        {member.role === 'owner' && (
                          <Badge variant="default" className="text-xs">Owner</Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner && member.user_id !== currentUserId && member.role !== 'owner' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRemoveMember(member.id, member.user_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}