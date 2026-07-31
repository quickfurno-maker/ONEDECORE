export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      consent_events: {
        Row: {
          actor_type: string
          channel: string
          contact_id: string
          copy_version: string
          created_at: string
          event_type: string
          evidence: Json
          id: string
          intake_request_id: string | null
          lead_id: string | null
          locale: string
          notice_version: string
          occurred_at: string
          purpose_code: string
          source: string
        }
        Insert: {
          actor_type: string
          channel: string
          contact_id: string
          copy_version: string
          created_at?: string
          event_type: string
          evidence?: Json
          id?: string
          intake_request_id?: string | null
          lead_id?: string | null
          locale?: string
          notice_version: string
          occurred_at?: string
          purpose_code: string
          source: string
        }
        Update: {
          actor_type?: string
          channel?: string
          contact_id?: string
          copy_version?: string
          created_at?: string
          event_type?: string
          evidence?: Json
          id?: string
          intake_request_id?: string | null
          lead_id?: string | null
          locale?: string
          notice_version?: string
          occurred_at?: string
          purpose_code?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_intake_request_id_fkey"
            columns: ["intake_request_id"]
            isOneToOne: false
            referencedRelation: "lead_intake_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_channels: {
        Row: {
          address_normalized: string
          channel_type: string
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address_normalized: string
          channel_type: string
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address_normalized?: string
          channel_type?: string
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          display_name: string
          id: string
          merged_into: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          merged_into?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          merged_into?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          actor_id: string | null
          created_at: string
          id: string
          lead_id: string
          metadata: Json
          occurred_at: string
          reference_id: string | null
          summary: string
        }
        Insert: {
          activity_type: string
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          metadata?: Json
          occurred_at?: string
          reference_id?: string | null
          summary: string
        }
        Update: {
          activity_type?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          metadata?: Json
          occurred_at?: string
          reference_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_history: {
        Row: {
          actor_id: string
          assignment_method: string
          id: string
          lead_id: string
          metadata: Json
          new_assignee: string | null
          occurred_at: string
          previous_assignee: string | null
          reason: string | null
        }
        Insert: {
          actor_id: string
          assignment_method: string
          id?: string
          lead_id: string
          metadata?: Json
          new_assignee?: string | null
          occurred_at?: string
          previous_assignee?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string
          assignment_method?: string
          id?: string
          lead_id?: string
          metadata?: Json
          new_assignee?: string | null
          occurred_at?: string
          previous_assignee?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_new_assignee_fkey"
            columns: ["new_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_previous_assignee_fkey"
            columns: ["previous_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_closure_reasons: {
        Row: {
          code: string
          created_at: string
          display_name: string
          display_order: number
          id: string
          is_active: boolean
          requires_note: boolean
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          display_order?: number
          id?: string
          is_active?: boolean
          requires_note?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          display_order?: number
          id?: string
          is_active?: boolean
          requires_note?: boolean
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
          lead_id: string
          occurred_at: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          lead_id: string
          occurred_at?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          lead_id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_ups: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          lead_id: string
          outcome: string | null
          owner_id: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          lead_id: string
          outcome?: string | null
          owner_id: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          lead_id?: string
          outcome?: string | null
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_ups_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          lead_id: string | null
          network_fingerprint_hash: string
          outcome_code: string | null
          phone_fingerprint_hash: string
          request_hash: string
          retry_after_seconds: number | null
          status: string
          submission_reference: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          lead_id?: string | null
          network_fingerprint_hash: string
          outcome_code?: string | null
          phone_fingerprint_hash: string
          request_hash: string
          retry_after_seconds?: number | null
          status: string
          submission_reference?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          network_fingerprint_hash?: string
          outcome_code?: string | null
          phone_fingerprint_hash?: string
          request_hash?: string
          retry_after_seconds?: number | null
          status?: string
          submission_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lead_intake_requests_lead"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_source_touchpoints: {
        Row: {
          campaign_reference: string | null
          created_at: string
          id: string
          lead_id: string
          metadata: Json
          occurred_at: string
          recorded_by: string | null
          source_detail: string | null
          source_id: string
          touchpoint_kind: string
        }
        Insert: {
          campaign_reference?: string | null
          created_at?: string
          id?: string
          lead_id: string
          metadata?: Json
          occurred_at?: string
          recorded_by?: string | null
          source_detail?: string | null
          source_id: string
          touchpoint_kind?: string
        }
        Update: {
          campaign_reference?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          metadata?: Json
          occurred_at?: string
          recorded_by?: string | null
          source_detail?: string | null
          source_id?: string
          touchpoint_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_source_touchpoints_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_source_touchpoints_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_source_touchpoints_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          display_order: number
          id: string
          is_active: boolean
          is_system: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sources_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          attribution: Json
          budget_comfort_code: string | null
          closed_lost_note: string | null
          closed_lost_reason_id: string | null
          contact_id: string
          created_at: string
          entry_method: string
          estimate_snapshot: Json | null
          id: string
          landing_path: string
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string
          primary_source_id: string
          property_code: string
          room_codes: string[]
          service_code: string
          source: string
          status: string
          submission_reference: string
          submitted_email: string | null
          submitted_name: string
          timeline_code: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attribution?: Json
          budget_comfort_code?: string | null
          closed_lost_note?: string | null
          closed_lost_reason_id?: string | null
          contact_id: string
          created_at?: string
          entry_method: string
          estimate_snapshot?: Json | null
          id?: string
          landing_path: string
          locality?: string | null
          message?: string | null
          on_hold_previous_status?: string | null
          on_hold_reason?: string | null
          on_hold_since?: string | null
          planner_version: string
          primary_source_id: string
          property_code: string
          room_codes?: string[]
          service_code: string
          source?: string
          status?: string
          submission_reference?: string
          submitted_email?: string | null
          submitted_name: string
          timeline_code: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attribution?: Json
          budget_comfort_code?: string | null
          closed_lost_note?: string | null
          closed_lost_reason_id?: string | null
          contact_id?: string
          created_at?: string
          entry_method?: string
          estimate_snapshot?: Json | null
          id?: string
          landing_path?: string
          locality?: string | null
          message?: string | null
          on_hold_previous_status?: string | null
          on_hold_reason?: string | null
          on_hold_since?: string | null
          planner_version?: string
          primary_source_id?: string
          property_code?: string
          room_codes?: string[]
          service_code?: string
          source?: string
          status?: string
          submission_reference?: string
          submitted_email?: string | null
          submitted_name?: string
          timeline_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_closed_lost_reason"
            columns: ["closed_lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lead_closure_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_primary_source_id_fkey"
            columns: ["primary_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_media: {
        Row: {
          alt_text: string
          caption: string | null
          created_at: string
          created_by: string
          file_size_bytes: number | null
          height_px: number | null
          id: string
          media_role: string
          mime_type: string | null
          project_id: string
          public_bucket: string
          public_object_path: string | null
          sort_order: number
          status: string
          updated_at: string
          updated_by: string
          width_px: number | null
        }
        Insert: {
          alt_text: string
          caption?: string | null
          created_at?: string
          created_by: string
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          media_role?: string
          mime_type?: string | null
          project_id: string
          public_bucket?: string
          public_object_path?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by: string
          width_px?: number | null
        }
        Update: {
          alt_text?: string
          caption?: string | null
          created_at?: string
          created_by?: string
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          media_role?: string
          mime_type?: string | null
          project_id?: string
          public_bucket?: string
          public_object_path?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_media_sources: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          media_id: string
          original_bucket: string
          original_file_name: string | null
          original_file_size_bytes: number
          original_mime_type: string
          original_object_path: string
          uploaded_by: string
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          media_id: string
          original_bucket?: string
          original_file_name?: string | null
          original_file_size_bytes: number
          original_mime_type: string
          original_object_path: string
          uploaded_by: string
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          media_id?: string
          original_bucket?: string
          original_file_name?: string | null
          original_file_size_bytes?: number
          original_mime_type?: string
          original_object_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_media_sources_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "portfolio_media"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_project_services: {
        Row: {
          created_at: string
          project_id: string
          service_code: string
        }
        Insert: {
          created_at?: string
          project_id: string
          service_code: string
        }
        Update: {
          created_at?: string
          project_id?: string
          service_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          completion_year: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_featured: boolean
          location_label: string | null
          property_type: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: string
          summary: string
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          completion_year?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_featured?: boolean
          location_label?: string | null
          property_type?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: string
          summary: string
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          completion_year?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          location_label?: string | null
          property_type?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone_e164: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone_e164?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone_e164?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_lead: {
        Args: { p_assignee_id: string; p_lead_id: string; p_reason?: string }
        Returns: {
          assigned_to: string | null
          attribution: Json
          budget_comfort_code: string | null
          closed_lost_note: string | null
          closed_lost_reason_id: string | null
          contact_id: string
          created_at: string
          entry_method: string
          estimate_snapshot: Json | null
          id: string
          landing_path: string
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string
          primary_source_id: string
          property_code: string
          room_codes: string[]
          service_code: string
          source: string
          status: string
          submission_reference: string
          submitted_email: string | null
          submitted_name: string
          timeline_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      authorize: { Args: { requested_permission: string }; Returns: boolean }
      cancel_lead_follow_up: {
        Args: { p_follow_up_id: string; p_outcome?: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          lead_id: string
          outcome: string | null
          owner_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_lead_follow_up: {
        Args: { p_follow_up_id: string; p_outcome?: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          lead_id: string
          outcome: string | null
          owner_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_lead_follow_up: {
        Args: { p_due_at: string; p_lead_id: string; p_owner_id?: string }
        Returns: {
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          lead_id: string
          outcome: string | null
          owner_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_lead_source: {
        Args: {
          p_code: string
          p_description?: string
          p_display_name: string
          p_display_order?: number
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          display_order: number
          id: string
          is_active: boolean
          is_system: boolean
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_portfolio_project_services: {
        Args: {
          requested_project_id: string
          requested_service_codes: string[]
        }
        Returns: {
          created_at: string
          project_id: string
          service_code: string
        }[]
        SetofOptions: {
          from: "*"
          to: "portfolio_project_services"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_portfolio_project_status: {
        Args: { requested_project_id: string; requested_status: string }
        Returns: {
          completion_year: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_featured: boolean
          location_label: string | null
          property_type: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: string
          summary: string
          title: string
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "portfolio_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_lead_intake: {
        Args: {
          p_attribution: Json
          p_budget_comfort_code: string
          p_consent_service_email: boolean
          p_consent_service_enquiry: boolean
          p_consent_service_phone: boolean
          p_consent_whatsapp: boolean
          p_copy_service_communication: string
          p_copy_service_enquiry: string
          p_copy_whatsapp: string
          p_estimate_snapshot: Json
          p_idempotency_key: string
          p_landing_path: string
          p_locality: string
          p_message: string
          p_network_fingerprint_hash: string
          p_notice_version: string
          p_phone_e164: string
          p_phone_fingerprint_hash: string
          p_planner_version: string
          p_property_code: string
          p_request_hash: string
          p_room_codes: string[]
          p_service_code: string
          p_source: string
          p_submitted_email: string
          p_submitted_name: string
          p_timeline_code: string
        }
        Returns: {
          duplicate: boolean
          outcome: string
          retry_after_seconds: number
          submission_reference: string
        }[]
      }
      transition_lead_status: {
        Args: {
          p_closure_reason_code?: string
          p_lead_id: string
          p_new_status: string
          p_reason?: string
        }
        Returns: {
          assigned_to: string | null
          attribution: Json
          budget_comfort_code: string | null
          closed_lost_note: string | null
          closed_lost_reason_id: string | null
          contact_id: string
          created_at: string
          entry_method: string
          estimate_snapshot: Json | null
          id: string
          landing_path: string
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string
          primary_source_id: string
          property_code: string
          room_codes: string[]
          service_code: string
          source: string
          status: string
          submission_reference: string
          submitted_email: string | null
          submitted_name: string
          timeline_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_lead_source: {
        Args: {
          p_description?: string
          p_display_name?: string
          p_display_order?: number
          p_is_active?: boolean
          p_source_id: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          display_order: number
          id: string
          is_active: boolean
          is_system: boolean
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
