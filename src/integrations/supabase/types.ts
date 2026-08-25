export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      blocked_content_patterns: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: number
          pattern: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: never
          pattern: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: never
          pattern?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          mentions: string[]
          moderation_hidden_at: string | null
          moderation_hidden_by: string | null
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          mentions?: string[]
          moderation_hidden_at?: string | null
          moderation_hidden_by?: string | null
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          mentions?: string[]
          moderation_hidden_at?: string | null
          moderation_hidden_by?: string | null
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_moderation_hidden_by_fkey"
            columns: ["moderation_hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hellos: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          message: string
          recipient_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          message: string
          recipient_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string
          recipient_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_id: string | null
          notes: string | null
          report_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          notes?: string | null
          report_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          notes?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderators: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderators_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          kind: string
          message_id: string | null
          post_id: string | null
          preview: string | null
          read_at: string | null
          tribe_id: string | null
          user_id: string
          venture_id: string | null
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          post_id?: string | null
          preview?: string | null
          read_at?: string | null
          tribe_id?: string | null
          user_id: string
          venture_id?: string | null
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          post_id?: string | null
          preview?: string | null
          read_at?: string | null
          tribe_id?: string | null
          user_id?: string
          venture_id?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          audience: string
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          moderation_hidden_at: string | null
          moderation_hidden_by: string | null
          replies_count: number
          shares_count: number
          tag: string | null
          tribe_id: string
          updated_at: string
        }
        Insert: {
          audience?: string
          author_id: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          moderation_hidden_at?: string | null
          moderation_hidden_by?: string | null
          replies_count?: number
          shares_count?: number
          tag?: string | null
          tribe_id: string
          updated_at?: string
        }
        Update: {
          audience?: string
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          moderation_hidden_at?: string | null
          moderation_hidden_by?: string | null
          replies_count?: number
          shares_count?: number
          tag?: string | null
          tribe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_moderation_hidden_by_fkey"
            columns: ["moderation_hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_locations: {
        Row: {
          accuracy_m: number
          discoverable: boolean
          latitude: number
          longitude: number
          radius_km: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number
          discoverable?: boolean
          latitude: number
          longitude: number
          radius_km?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number
          discoverable?: boolean
          latitude?: number
          longitude?: number
          radius_km?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adult_verified_at: string | null
          age: number | null
          age_verification_locked_at: string | null
          availability: string[]
          avatar_emoji: string
          avatar_url: string | null
          bio: string
          city: string
          created_at: string
          date_of_birth: string | null
          display_name: string
          handle: string | null
          id: string
          interests: string[]
          plan: Database["public"]["Enums"]["app_plan"]
          social_intents: string[]
          suspended_at: string | null
          suspended_by: string | null
          tribe_changed_at: string | null
          tribe_ids: string[]
          updated_at: string
          venture_count: number
        }
        Insert: {
          adult_verified_at?: string | null
          age?: number | null
          age_verification_locked_at?: string | null
          availability?: string[]
          avatar_emoji?: string
          avatar_url?: string | null
          bio?: string
          city?: string
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          handle?: string | null
          id: string
          interests?: string[]
          plan?: Database["public"]["Enums"]["app_plan"]
          social_intents?: string[]
          suspended_at?: string | null
          suspended_by?: string | null
          tribe_changed_at?: string | null
          tribe_ids?: string[]
          updated_at?: string
          venture_count?: number
        }
        Update: {
          adult_verified_at?: string | null
          age?: number | null
          age_verification_locked_at?: string | null
          availability?: string[]
          avatar_emoji?: string
          avatar_url?: string | null
          bio?: string
          city?: string
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          handle?: string | null
          id?: string
          interests?: string[]
          plan?: Database["public"]["Enums"]["app_plan"]
          social_intents?: string[]
          suspended_at?: string | null
          suspended_by?: string | null
          tribe_changed_at?: string | null
          tribe_ids?: string[]
          updated_at?: string
          venture_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          action: string | null
          created_at: string
          details: string | null
          due_at: string
          id: string
          moderator_notes: string | null
          reason: string
          reporter_deleted_at: string | null
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_deleted_at: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_kind"]
        }
        Insert: {
          action?: string | null
          created_at?: string
          details?: string | null
          due_at?: string
          id?: string
          moderator_notes?: string | null
          reason: string
          reporter_deleted_at?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_deleted_at?: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_kind"]
        }
        Update: {
          action?: string | null
          created_at?: string
          details?: string | null
          due_at?: string
          id?: string
          moderator_notes?: string | null
          reason?: string
          reporter_deleted_at?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_deleted_at?: string | null
          target_id?: string
          target_kind?: Database["public"]["Enums"]["report_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tribe_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string | null
          tribe_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id?: string | null
          tribe_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string | null
          tribe_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tribe_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tribe_members_tribe_id_fkey"
            columns: ["tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tribe_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          mentions: string[]
          reply_to_id: string | null
          room_kind: string | null
          room_metadata: Json
          sender_id: string
          tribe_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          mentions?: string[]
          reply_to_id?: string | null
          room_kind?: string | null
          room_metadata?: Json
          sender_id: string
          tribe_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          mentions?: string[]
          reply_to_id?: string | null
          room_kind?: string | null
          room_metadata?: Json
          sender_id?: string
          tribe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "tribe_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_room_reactions: {
        Row: {
          created_at: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_room_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "tribe_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tribe_room_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tribe_room_reads: {
        Row: {
          last_read_at: string
          tribe_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          tribe_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          tribe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tribe_room_reads_tribe_id_fkey"
            columns: ["tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tribe_room_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tribes: {
        Row: {
          created_at: string
          id: string
          key: string | null
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string | null
          name?: string | null
        }
        Relationships: []
      }
      venture_applications: {
        Row: {
          applicant_id: string
          created_at: string
          decided_at: string | null
          id: string
          message: string
          status: string
          venture_id: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string
          status?: string
          venture_id: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string
          status?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venture_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_applications_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      venture_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          venture_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          venture_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venture_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_messages_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      venture_venues: {
        Row: {
          arrival_details: string
          created_at: string
          updated_at: string
          venture_id: string
        }
        Insert: {
          arrival_details: string
          created_at?: string
          updated_at?: string
          venture_id: string
        }
        Update: {
          arrival_details?: string
          created_at?: string
          updated_at?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venture_venues_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: true
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      ventures: {
        Row: {
          closed_at: string | null
          created_at: string
          ended_at: string | null
          ends_at: string | null
          filled_slots: number
          id: string
          image_url: string | null
          intents: string[]
          max_slots: number
          note: string
          scope: string
          starts_at: string | null
          status: string
          time_window: string
          title: string
          user_id: string
          venue_place_id: string | null
          venue_tz: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ended_at?: string | null
          ends_at?: string | null
          filled_slots?: number
          id?: string
          image_url?: string | null
          intents?: string[]
          max_slots?: number
          note?: string
          scope?: string
          starts_at?: string | null
          status?: string
          time_window?: string
          title?: string
          user_id: string
          venue_place_id?: string | null
          venue_tz?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ended_at?: string | null
          ends_at?: string | null
          filled_slots?: number
          id?: string
          image_url?: string | null
          intents?: string[]
          max_slots?: number
          note?: string
          scope?: string
          starts_at?: string | null
          status?: string
          time_window?: string
          title?: string
          user_id?: string
          venue_place_id?: string | null
          venue_tz?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventures_venue_place_id_fkey"
            columns: ["venue_place_id"]
            isOneToOne: false
            referencedRelation: "venue_places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_place_coordinates: {
        Row: {
          fetched_at: string
          latitude: number
          longitude: number
          venue_place_id: string
        }
        Insert: {
          fetched_at?: string
          latitude: number
          longitude: number
          venue_place_id: string
        }
        Update: {
          fetched_at?: string
          latitude?: number
          longitude?: number
          venue_place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_place_coordinates_venue_place_id_fkey"
            columns: ["venue_place_id"]
            isOneToOne: true
            referencedRelation: "venue_places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_places: {
        Row: {
          area: string
          created_at: string
          created_by: string
          google_place_id: string | null
          host_label: string
          id: string
        }
        Insert: {
          area?: string
          created_at?: string
          created_by?: string
          google_place_id?: string | null
          host_label: string
          id?: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string
          google_place_id?: string | null
          host_label?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adult_gate_enabled: { Args: never; Returns: boolean }
      age_in_years: { Args: { value: string }; Returns: number }
      can_direct_message: { Args: { _a: string; _b: string }; Returns: boolean }
      content_is_blocked: { Args: { value: string }; Returns: boolean }
      current_user_is_moderator: { Args: never; Returns: boolean }
      expire_venue_coordinates: { Args: never; Returns: number }
      has_blocked: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      has_venture_application: {
        Args: { _user_id: string; _venture_id: string }
        Returns: boolean
      }
      is_tribe_member:
        | { Args: { p_tribe_id: string; p_user_id: string }; Returns: boolean }
        | { Args: { p_tribe_key: string; p_user_id: string }; Returns: boolean }
      is_venture_chat_open: { Args: { _venture_id: string }; Returns: boolean }
      is_venture_host: {
        Args: { _user_id: string; _venture_id: string }
        Returns: boolean
      }
      is_venture_joinable: { Args: { _venture_id: string }; Returns: boolean }
      is_venture_member: {
        Args: { _user_id: string; _venture_id: string }
        Returns: boolean
      }
      is_venture_scope_visible: {
        Args: { _venture_id: string; _viewer_id: string }
        Returns: boolean
      }
      is_verified_adult: { Args: { profile_id: string }; Returns: boolean }
      list_explore_matches: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          distance_band: string
          open_venture_id: string
          open_venture_title: string
          profile_id: string
          same_tribe: boolean
          score: number
          shared_availability: string[]
          shared_intents: string[]
          shared_interests: string[]
        }[]
      }
      list_nearby_profile_matches: {
        Args: { _limit?: number }
        Returns: {
          distance_band: string
          match_score: number
          profile_id: string
        }[]
      }
      list_venture_distance_bands: {
        Args: { _venture_ids: string[] }
        Returns: {
          distance_band: string
          venture_id: string
        }[]
      }
      moderate_report: {
        Args: { decision: string; notes?: string; report_id: string }
        Returns: {
          action: string | null
          created_at: string
          details: string | null
          due_at: string
          id: string
          moderator_notes: string | null
          reason: string
          reporter_deleted_at: string | null
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_deleted_at: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_kind"]
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tribe_switch_available_at: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_plan: "free" | "plus"
      report_kind: "post" | "user" | "comment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_plan: ["free", "plus"],
      report_kind: ["post", "user", "comment"],
    },
  },
} as const
