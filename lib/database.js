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

  // Get games user owns
  const { data: ownedGames, error: ownedError } = await supabase
    .from('games')
    .select('*')
    .eq('created_by', user.id)

  if (ownedError) {
    console.error('Error fetching owned games:', ownedError)
    throw ownedError
  }

  console.log('Owned games:', ownedGames?.length || 0)

  // Get games user is a member of (including as owner)
  const { data: memberGames, error: memberError } = await supabase
    .from('game_members')
    .select(`
      game_id,
      role,
      games (*)
    `)
    .eq('user_id', user.id)

  if (memberError) {
    console.error('Error fetching member games:', memberError)
    // Don't throw error, just use owned games
  } else {
    console.log('Member games:', memberGames?.length || 0)
  }

  // Combine owned and member games, removing duplicates
  const gameMap = new Map()
  
  // Add owned games
  ;(ownedGames || []).forEach(game => {
    console.log('Adding owned game:', game.name)
    gameMap.set(game.id, { ...game, userRole: 'owner' })
  })
  
  // Add member games (including those where user is owner)
  ;(memberGames || []).forEach(member => {
    if (member.games) {
      console.log('Adding member game:', member.games.name, 'role:', member.role)
      gameMap.set(member.games.id, { ...member.games, userRole: member.role })
    }
  })
  
  const allGames = Array.from(gameMap.values())
  console.log('Total games found:', allGames.length)

  // Sort by updated_at
  allGames.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return allGames
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

  // Check if user owns the game
  const { data: game } = await supabase
    .from('games')
    .select('created_by')
    .eq('id', gameId)
    .eq('created_by', user.id)
    .single()

  if (game) return true

  // Check if user is a member
  const { data: member } = await supabase
    .from('game_members')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .single()

  return !!member
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
  const { data, error } = await supabase
    .from('game_invites')
    .select(`
      *,
      invited_by_profile:invited_by (email),
      accepted_by_profile:accepted_by (email)
    `)
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getPendingInvites() {
  const user = await getCurrentUser()
  if (!user) throw new Error('User must be authenticated')

  const { data, error } = await supabase
    .from('game_invites')
    .select(`
      *,
      games (
        id,
        name,
        season,
        currency,
        fine_amount
      ),
      invited_by_profile:invited_by (email)
    `)
    .eq('invited_email', user.email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())

  if (error) throw error
  return data || []
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
  const { data, error } = await supabase
    .from('game_members')
    .select(`
      *,
      profiles:user_id (
        username
      ),
      auth_users:user_id (
        email
      )
    `)
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return data || []
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