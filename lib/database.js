import { supabase } from './supabase.js'

// ============= AUTHENTICATION =============

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

// ============= GAMES =============

export async function createGame(name, settings = {}) {
  const user = await getCurrentUser()
  if (!user) throw new Error('User must be authenticated')

  const { data, error } = await supabase
    .from('games')
    .insert([{
      name,
      season: settings.season || 'S1',
      fine_amount: settings.fineAmount || 10,
      currency: settings.currency || 'RM',
      created_by: user.id
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getGame(gameId) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error) throw error
  return data
}

export async function getUserGames() {
  const user = await getCurrentUser()
  if (!user) throw new Error('User must be authenticated')

  console.log('Getting games for user:', user.id)

  // Use the new database function that handles access control
  const { data, error } = await supabase
    .rpc('get_user_games')

  if (error) {
    console.error('Error fetching user games:', error)
    throw error
  }

  console.log('User games from function:', data?.length || 0, data)
  return data || []
}

export async function updateGame(gameId, updates) {
  const { data, error } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteGame(gameId) {
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', gameId)

  if (error) throw error
}

// ============= PLAYERS =============

export async function addPlayer(gameId, name) {
  const { data, error } = await supabase
    .from('players')
    .insert([{
      game_id: gameId,
      name: name.trim()
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getPlayers(gameId) {
  // Check access first
  const hasAccess = await hasGameAccess(gameId)
  if (!hasAccess) {
    throw new Error('Access denied to this game')
  }

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function updatePlayer(playerId, updates) {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePlayer(playerId) {
  // Delete all events for this player first
  await supabase
    .from('events')
    .delete()
    .eq('player_id', playerId)

  // Then delete the player
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId)

  if (error) throw error
}

// ============= EVENTS =============

export async function addEvent(gameId, playerId, reason, amount) {
  const { data, error } = await supabase
    .from('events')
    .insert([{
      game_id: gameId,
      player_id: playerId,
      reason: reason.trim() || 'Late',
      amount: amount,
      date_iso: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getEvents(gameId) {
  // Check access first
  const hasAccess = await hasGameAccess(gameId)
  if (!hasAccess) {
    throw new Error('Access denied to this game')
  }

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      players:player_id (
        id,
        name
      )
    `)
    .eq('game_id', gameId)
    .order('date_iso', { ascending: false })

  if (error) throw error
  return data || []
}

export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)

  if (error) throw error
}

export async function clearAllEvents(gameId) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('game_id', gameId)

  if (error) throw error
}

// ============= ACCESS CONTROL =============

export async function hasGameAccess(gameId) {
  const user = await getCurrentUser()
  if (!user) return false

  // Use the new database function for access control
  const { data, error } = await supabase
    .rpc('user_has_game_access', { game_id_param: gameId })

  if (error) {
    console.error('Error checking game access:', error)
    return false
  }

  return data === true
}

// ============= COMBINED OPERATIONS =============

export async function getGameData(gameId) {
  const [game, players, events] = await Promise.all([
    getGame(gameId),
    getPlayers(gameId),
    getEvents(gameId)
  ])

  return { game, players, events }
}

export async function resetSeason(gameId) {
  const game = await getGame(gameId)
  const currentSeasonNum = parseInt(game.season.replace(/\D/g, '')) || 1
  const newSeason = `S${currentSeasonNum + 1}`

  // Clear all events and update season
  await Promise.all([
    clearAllEvents(gameId),
    updateGame(gameId, { season: newSeason })
  ])

  return newSeason
}

// ============= REAL-TIME SUBSCRIPTIONS =============

export function subscribeToGameChanges(gameId, callback) {
  // Subscribe to players changes
  const playersSubscription = supabase
    .channel(`players:${gameId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'players',
      filter: `game_id=eq.${gameId}`
    }, callback)
    .subscribe()

  // Subscribe to events changes
  const eventsSubscription = supabase
    .channel(`events:${gameId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'events',
      filter: `game_id=eq.${gameId}`
    }, callback)
    .subscribe()

  // Subscribe to game changes
  const gameSubscription = supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, callback)
    .subscribe()

  // Return cleanup function
  return () => {
    playersSubscription.unsubscribe()
    eventsSubscription.unsubscribe()
    gameSubscription.unsubscribe()
  }
}

// ============= INVITES =============

export async function createGameInvite(gameId, email) {
  const { data, error } = await supabase
    .from('game_invites')
    .insert([{
      game_id: gameId,
      invited_email: email.toLowerCase().trim(),
      invited_by: (await getCurrentUser()).id
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getGameInvites(gameId) {
  // Get invites without foreign key relationships
  const { data: invites, error } = await supabase
    .from('game_invites')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!invites || invites.length === 0) {
    return []
  }

  // Manually fetch user data if needed
  const userIds = [...new Set([
    ...invites.map(invite => invite.invited_by),
    ...invites.map(invite => invite.accepted_by).filter(Boolean)
  ])]

  if (userIds.length === 0) {
    return invites.map(invite => ({
      ...invite,
      invited_by_profile: { email: 'Unknown User' },
      accepted_by_profile: invite.accepted_by ? { email: 'Unknown User' } : null
    }))
  }

  // Get user profiles
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('user_id', userIds)

  if (usersError) {
    console.warn('Could not fetch user profiles:', usersError)
  }

  // Combine the data manually
  const enrichedInvites = invites.map(invite => {
    const invitedByUser = users?.find(u => u.user_id === invite.invited_by)
    const acceptedByUser = users?.find(u => u.user_id === invite.accepted_by)
    
    return {
      ...invite,
      invited_by_profile: invitedByUser ? { email: invitedByUser.username } : { email: 'Unknown User' },
      accepted_by_profile: acceptedByUser ? { email: acceptedByUser.username } : null
    }
  })

  return enrichedInvites
}

export async function getPendingInvites() {
  const user = await getCurrentUser()
  if (!user) throw new Error('User must be authenticated')

  // Get invites without foreign key relationships (since RLS is disabled)
  const { data: invites, error: invitesError } = await supabase
    .from('game_invites')
    .select('*')
    .eq('invited_email', user.email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())

  if (invitesError) throw invitesError

  if (!invites || invites.length === 0) {
    return []
  }

  // Manually fetch related data
  const gameIds = [...new Set(invites.map(invite => invite.game_id))]
  const userIds = [...new Set(invites.map(invite => invite.invited_by))]

  // Get games data
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name, season, currency, fine_amount')
    .in('id', gameIds)

  if (gamesError) throw gamesError

  // Get user emails for invited_by
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('user_id', userIds)

  if (usersError) {
    console.warn('Could not fetch user profiles:', usersError)
  }

  // Combine the data manually
  const enrichedInvites = invites.map(invite => {
    const game = games?.find(g => g.id === invite.game_id)
    const invitedByUser = users?.find(u => u.user_id === invite.invited_by)
    
    return {
      ...invite,
      games: game || { id: invite.game_id, name: 'Unknown Game' },
      invited_by_profile: invitedByUser ? { email: invitedByUser.username } : { email: 'Unknown User' }
    }
  })

  return enrichedInvites
}

export async function acceptInvite(inviteCode) {
  const { data, error } = await supabase
    .rpc('accept_game_invite', { invite_code_param: inviteCode })

  if (error) throw error
  return data[0] // Returns { success: boolean, message: string, game_id: uuid }
}

export async function declineInvite(inviteId) {
  const { error } = await supabase
    .from('game_invites')
    .update({ status: 'declined' })
    .eq('id', inviteId)

  if (error) throw error
}

export async function cancelInvite(inviteId) {
  const { error } = await supabase
    .from('game_invites')
    .delete()
    .eq('id', inviteId)

  if (error) throw error
}

export async function getGameMembers(gameId) {
  // Get members without foreign key relationships
  const { data: members, error } = await supabase
    .from('game_members')
    .select('*')
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  if (!members || members.length === 0) {
    return []
  }

  // Get user profiles manually
  const userIds = members.map(member => member.user_id)
  
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('user_id', userIds)

  if (profilesError) {
    console.warn('Could not fetch profiles:', profilesError)
  }

  // Get user emails from auth.users (if accessible)
  let authUsers = []
  try {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    if (!usersError && users?.users) {
      authUsers = users.users.filter(user => userIds.includes(user.id))
    }
  } catch (error) {
    console.warn('Could not fetch auth users:', error)
  }

  // Combine the data manually
  const enrichedMembers = members.map(member => {
    const profile = profiles?.find(p => p.user_id === member.user_id)
    const authUser = authUsers?.find(u => u.id === member.user_id)
    
    return {
      ...member,
      profiles: profile ? { username: profile.username } : { username: 'Unknown User' },
      auth_users: authUser ? { email: authUser.email } : { email: 'Unknown Email' }
    }
  })

  return enrichedMembers
}

export async function removeGameMember(gameId, userId) {
  const { error } = await supabase
    .from('game_members')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function leaveGame(gameId) {
  const user = await getCurrentUser()
  if (!user) throw new Error('User must be authenticated')

  const { error } = await supabase
    .from('game_members')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', user.id)

  if (error) throw error
}

// ============= UTILITIES =============

export function generateId() {
  return crypto.randomUUID()
}