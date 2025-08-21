#!/usr/bin/env node

/**
 * Database Clear Script
 * 
 * This script will completely clear all data from your Late Fine Tracker database.
 * Use with caution - this action cannot be undone!
 * 
 * Usage:
 *   node scripts/clear-database.js
 * 
 * Options:
 *   --confirm    Skip confirmation prompt
 *   --tables     Comma-separated list of specific tables to clear
 *   --dry-run    Show what would be deleted without actually deleting
 */

import { supabase } from '../lib/supabase.js'
import readline from 'readline'

// Database tables in dependency order (children first, then parents)
const TABLES = [
  'events',           // Events reference players and games
  'players',          // Players reference games
  'game_invites',     // Invites reference games and users
  'game_members',     // Members reference games and users
  'games',            // Games reference users (created_by)
  'profiles'          // Profiles reference auth.users (but we keep auth.users)
]

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Parse command line arguments
const args = process.argv.slice(2)
const flags = {
  confirm: args.includes('--confirm'),
  dryRun: args.includes('--dry-run'),
  tables: args.find(arg => arg.startsWith('--tables='))?.split('=')[1]?.split(',') || TABLES
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function getTableRowCount(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.warn(`⚠️  Could not get count for ${tableName}: ${error.message}`)
      return 'unknown'
    }
    
    return count
  } catch (error) {
    console.warn(`⚠️  Could not get count for ${tableName}: ${error.message}`)
    return 'unknown'
  }
}

async function clearTable(tableName, dryRun = false) {
  try {
    const rowCount = await getTableRowCount(tableName)
    
    if (dryRun) {
      console.log(`🔍 DRY RUN: Would delete ${rowCount} rows from ${tableName}`)
      return { success: true, deletedCount: rowCount }
    }
    
    console.log(`🗑️  Clearing ${tableName} (${rowCount} rows)...`)
    
    const { error, count } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows (impossible UUID condition)
    
    if (error) {
      console.error(`❌ Failed to clear ${tableName}: ${error.message}`)
      return { success: false, error: error.message }
    }
    
    console.log(`✅ Successfully cleared ${tableName}`)
    return { success: true, deletedCount: count }
    
  } catch (error) {
    console.error(`❌ Error clearing ${tableName}: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function askConfirmation(message) {
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      resolve(answer.toLowerCase().startsWith('y'))
    })
  })
}

async function showDatabaseStats() {
  console.log('\n📊 Current database status:')
  console.log('─'.repeat(40))
  
  for (const table of TABLES) {
    const count = await getTableRowCount(table)
    console.log(`${table.padEnd(15)} ${count.toString().padStart(8)} rows`)
  }
  console.log('─'.repeat(40))
}

async function main() {
  try {
    console.log('🧹 Late Fine Tracker Database Cleaner')
    console.log('====================================\n')
    
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      console.error('❌ You must be authenticated to run this script')
      console.log('Please sign in to your Supabase account first.')
      process.exit(1)
    }
    
    console.log(`👤 Authenticated as: ${user.email}`)
    
    // Show current database status
    await showDatabaseStats()
    
    // Filter tables if specific ones requested
    const tablesToClear = flags.tables.filter(table => TABLES.includes(table))
    
    if (tablesToClear.length === 0) {
      console.error('❌ No valid tables specified')
      process.exit(1)
    }
    
    console.log(`\n🎯 Target tables: ${tablesToClear.join(', ')}`)
    
    if (flags.dryRun) {
      console.log('\n🔍 DRY RUN MODE - No data will actually be deleted\n')
    } else {
      console.log('\n⚠️  WARNING: This will permanently delete all data!')
      console.log('This action cannot be undone!\n')
    }
    
    // Ask for confirmation unless --confirm flag is used
    if (!flags.confirm && !flags.dryRun) {
      const confirmed = await askConfirmation('Are you sure you want to proceed? (y/N): ')
      if (!confirmed) {
        console.log('❌ Operation cancelled')
        process.exit(0)
      }
    }
    
    // Clear tables in dependency order
    console.log('\n🚀 Starting database clear operation...\n')
    
    const results = {
      success: [],
      failed: [],
      totalDeleted: 0
    }
    
    for (const table of tablesToClear) {
      const result = await clearTable(table, flags.dryRun)
      
      if (result.success) {
        results.success.push({ table, count: result.deletedCount })
        if (typeof result.deletedCount === 'number') {
          results.totalDeleted += result.deletedCount
        }
      } else {
        results.failed.push({ table, error: result.error })
      }
    }
    
    // Show summary
    console.log('\n📋 Operation Summary')
    console.log('===================')
    
    if (results.success.length > 0) {
      console.log('\n✅ Successfully cleared:')
      results.success.forEach(({ table, count }) => {
        console.log(`   ${table}: ${count} rows`)
      })
    }
    
    if (results.failed.length > 0) {
      console.log('\n❌ Failed to clear:')
      results.failed.forEach(({ table, error }) => {
        console.log(`   ${table}: ${error}`)
      })
    }
    
    if (!flags.dryRun) {
      console.log(`\n🗑️  Total rows deleted: ${results.totalDeleted}`)
      
      if (results.failed.length === 0) {
        console.log('\n🎉 Database successfully cleared!')
      } else {
        console.log('\n⚠️  Database partially cleared with some errors')
      }
    } else {
      console.log('\n🔍 Dry run completed - no data was actually deleted')
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n❌ Operation cancelled by user')
  rl.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n❌ Operation terminated')
  rl.close()
  process.exit(0)
})

// Run the script
main().catch(error => {
  console.error('💥 Unhandled error:', error)
  rl.close()
  process.exit(1)
})