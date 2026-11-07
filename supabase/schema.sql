-- ==============================================================
-- Duet: Complete Supabase Database Schema & Setup
-- Run this in your Supabase Project's SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==============================================================
-- PROFILES / USERS
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  photo_url TEXT,
  cloudinary_public_id TEXT,
  bio TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Case-insensitive index on username for quick search
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));

-- Auto-sync profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 1;
BEGIN
  -- Derive default username from email or metadata
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1), '[^a-z0-9_.-]', '', 'g'));
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user_' || SUBSTRING(NEW.id::TEXT, 1, 6);
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || counter::TEXT;
    counter := counter + 1;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, email, photo_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', final_username),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = COALESCE(NULLIF(public.profiles.photo_url, ''), EXCLUDED.photo_url),
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================
-- FRIENDS & FRIEND REQUESTS
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends (user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends (friend_id);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests (to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests (from_user_id);

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_users ON public.blocked_users (user_id, blocked_id);

-- ==============================================================
-- CHATS & CHAT PARTICIPANTS
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY, -- e.g. 'uid1_uid2'
  participant_ids UUID[] NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_id TEXT,
  music_state JSONB DEFAULT NULL,
  typing JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON public.chats USING GIN(participant_ids);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unread_count INT DEFAULT 0,
  is_muted BOOLEAN DEFAULT false,
  PRIMARY KEY (chat_id, user_id)
);

-- ==============================================================
-- MESSAGES
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT,
  sender_photo TEXT,
  text TEXT DEFAULT '',
  type TEXT DEFAULT 'text', -- 'text', 'image', 'voice', 'call'
  image JSONB DEFAULT NULL,
  voice JSONB DEFAULT NULL,
  is_reply BOOLEAN DEFAULT false,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  original_message_text TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_saved BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  edit_history JSONB DEFAULT '[]'::jsonb,
  can_edit_until TIMESTAMPTZ,
  deletion_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_deletion ON public.messages (deletion_time) WHERE is_saved = false;

CREATE TABLE IF NOT EXISTS public.saved_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_messages_user_chat ON public.saved_messages (user_id, chat_id);

-- ==============================================================
-- MUSIC QUEUE
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.music_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  duration TEXT,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_by_name TEXT,
  played BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_music_queue_chat ON public.music_queue (chat_id, created_at ASC);

-- ==============================================================
-- ACTIVE CALLS (Signaling & Calling)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.active_calls (
  id TEXT PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caller_name TEXT,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_name TEXT,
  status TEXT NOT NULL DEFAULT 'ringing', -- 'ringing', 'accepted', 'declined', 'ended', 'missed'
  type TEXT DEFAULT 'audio',             -- 'audio', 'video'
  duration INT DEFAULT 0,
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_active_calls_receiver ON public.active_calls (receiver_id, status);

-- ==============================================================
-- APP CONFIG (Releases, updates)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
INSERT INTO public.app_config (key, data)
VALUES ('latestRelease', '{"version": "1.1.9", "apkUrl": "", "notes": "Initial Supabase Release"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ==============================================================
-- REALTIME REPLICATION SETUP
-- Enables Supabase Realtime to stream postgres changes to client
-- ==============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.music_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;

-- ==============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can read profiles; users can update their own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Friends: users can see friends they belong to
CREATE POLICY "Friends visible to involved users"
  ON public.friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships"
  ON public.friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships"
  ON public.friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Friend Requests: sender or receiver can access
CREATE POLICY "Friend requests visible to participants"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Sender can create friend requests"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Receiver or sender can update friend request status"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Participants can delete friend requests"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Blocked users
CREATE POLICY "Users can manage blocked users"
  ON public.blocked_users FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Chats: visible if user is a participant
CREATE POLICY "Chats visible to participants"
  ON public.chats FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can create chats"
  ON public.chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can update chats"
  ON public.chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can delete chats"
  ON public.chats FOR DELETE
  TO authenticated
  USING (auth.uid() = ANY(participant_ids));

-- Chat Participants
CREATE POLICY "Chat participants visible to participants"
  ON public.chat_participants FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.chats c WHERE c.id = chat_id AND auth.uid() = ANY(c.participant_ids)
  ));

-- Messages: participants can select, insert, update
CREATE POLICY "Messages visible to chat participants"
  ON public.messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chats c WHERE c.id = chat_id AND auth.uid() = ANY(c.participant_ids)
  ));

CREATE POLICY "Participants can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND auth.uid() = ANY(c.participant_ids))
  );

CREATE POLICY "Sender or recipient can update message status"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chats c WHERE c.id = chat_id AND auth.uid() = ANY(c.participant_ids)
  ));

CREATE POLICY "Sender can delete own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Saved messages
CREATE POLICY "Users can manage saved messages"
  ON public.saved_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Music Queue
CREATE POLICY "Queue visible to chat participants"
  ON public.music_queue FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chats c WHERE c.id = chat_id AND auth.uid() = ANY(c.participant_ids)
  ));

-- Active calls
CREATE POLICY "Active calls accessible to caller and receiver"
  ON public.active_calls FOR ALL
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- App Config: readable by everyone
CREATE POLICY "App config readable by authenticated users"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================================
-- AUTOMATED 15-MINUTE MESSAGE CLEANUP (pg_cron)
-- ==============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages
  WHERE deletion_time IS NOT NULL
    AND deletion_time <= now()
    AND is_saved = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cleanup every 15 minutes (if pg_cron is enabled in Supabase extensions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-messages-job',
      '*/15 * * * *',
      'SELECT public.cleanup_expired_messages();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fallback if cron cannot be scheduled via script
  RAISE NOTICE 'pg_cron schedule notice: %', SQLERRM;
END $$;

