#!/usr/bin/env node

/**
 * scripts/verify-telegram.mjs
 *
 * Verify Telegram Bot credentials and chat_id configuration.
 *
 * Usage:
 *   node scripts/verify-telegram.mjs
 *
 * Requires:
 *   TELEGRAM_BOT_TOKEN  — Bot API token (from @BotFather)
 *   TELEGRAM_CHAT_ID    — (optional) Chat/group/channel ID to validate
 *
 * Security:
 *   - Token is NEVER printed.
 *   - Only bot username/id and chat title/type are displayed.
 *   - getUpdates output is filtered to show only chat.id values (no message content).
 *
 * Exit codes:
 *   0 — Token valid (and chat_id valid if provided)
 *   1 — Token missing or invalid
 *   2 — chat_id invalid
 */

import { config } from 'dotenv';
const dotenvResult = config(); // Load .env

if (dotenvResult.error && !process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('⚠️  Could not load .env file:', dotenvResult.error.message);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set.');
  console.error('   Set it in .env or export it before running this script.');
  process.exit(1);
}

const baseUrl = `https://api.telegram.org/bot${token}`;

// ─── Step 1: Verify token via getMe ─────────────────────────────────────────

console.log('🔍 Verifying bot token via getMe...');

try {
  const res = await fetch(`${baseUrl}/getMe`);
  const json = await res.json();

  if (!json.ok) {
    console.error('❌ getMe failed:', json.description || 'unknown error');
    console.error('   Your TELEGRAM_BOT_TOKEN is likely invalid.');
    process.exit(1);
  }

  const bot = json.result;
  console.log(`✅ Bot verified:`);
  console.log(`   Username: @${bot.username}`);
  console.log(`   Bot ID:   ${bot.id}`);
  console.log(`   Name:     ${bot.first_name}`);
} catch (err) {
  console.error('❌ Network error calling getMe:', err.message);
  process.exit(1);
}

// ─── Step 2: Validate chat_id (if provided) ─────────────────────────────────

if (chatId) {
  console.log(`\n🔍 Validating TELEGRAM_CHAT_ID=${chatId} via getChat...`);

  try {
    const res = await fetch(`${baseUrl}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const json = await res.json();

    if (!json.ok) {
      console.error(`❌ getChat failed: ${json.description || 'unknown'}`);
      console.error('   The chat_id may be wrong, or the bot is not a member of the chat.');
      process.exit(2);
    }

    const chat = json.result;
    console.log(`✅ Chat verified:`);
    console.log(`   Type:  ${chat.type}`);
    console.log(`   Title: ${chat.title || chat.first_name || '(DM)'}`);
    console.log(`   ID:    ${chat.id}`);
  } catch (err) {
    console.error('❌ Network error calling getChat:', err.message);
    process.exit(2);
  }
} else {
  // ─── Step 2b: Help discover chat_id via getUpdates ──────────────────────

  console.log('\n⚠️  TELEGRAM_CHAT_ID is not set.');
  console.log('   Fetching recent updates to help you find it...\n');

  try {
    const res = await fetch(`${baseUrl}/getUpdates?limit=10&timeout=0`);
    const json = await res.json();

    if (!json.ok || !json.result?.length) {
      console.log('   No recent updates found.');
      console.log('   → Send a message to your bot (or add it to a group), then re-run this script.');
    } else {
      const chatIds = new Set();
      for (const update of json.result) {
        const chat = update.message?.chat || update.channel_post?.chat;
        if (chat) {
          chatIds.add(JSON.stringify({ id: chat.id, type: chat.type, title: chat.title || chat.first_name }));
        }
      }

      if (chatIds.size === 0) {
        console.log('   Updates found but no chat info extracted.');
        console.log('   → Send a text message to the bot and re-run.');
      } else {
        console.log('   Found these chats in recent updates:');
        for (const entry of chatIds) {
          const parsed = JSON.parse(entry);
          console.log(`   • chat_id=${parsed.id}  type=${parsed.type}  title="${parsed.title}"`);
        }
        console.log('\n   → Set TELEGRAM_CHAT_ID to the desired chat_id in your .env file.');
      }
    }
  } catch (err) {
    console.error('   ❌ Network error calling getUpdates:', err.message);
  }
}

console.log('\n✅ Telegram verification complete.');
