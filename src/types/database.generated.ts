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
      attendance_corrections: {
        Row: {
          actor_id: string
          after_digest: string
          attendance_date: string
          before_digest: string
          correction_type: string
          created_at: string
          details: Json
          id: string
          reason: string
          staff_id: string
        }
        Insert: {
          actor_id: string
          after_digest: string
          attendance_date: string
          before_digest: string
          correction_type: string
          created_at?: string
          details?: Json
          id?: string
          reason: string
          staff_id: string
        }
        Update: {
          actor_id?: string
          after_digest?: string
          attendance_date?: string
          before_digest?: string
          correction_type?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_days: {
        Row: {
          attendance_date: string
          attendance_policy_id: string
          created_at: string
          derived_at: string
          first_check_in_at: string | null
          has_manual_adjustment: boolean
          is_early_checkout: boolean
          is_late: boolean
          is_missing_checkout: boolean
          last_check_out_at: string | null
          open_session: boolean
          primary_status: string
          staff_id: string
          updated_at: string
          worked_minutes: number
        }
        Insert: {
          attendance_date: string
          attendance_policy_id: string
          created_at?: string
          derived_at?: string
          first_check_in_at?: string | null
          has_manual_adjustment?: boolean
          is_early_checkout?: boolean
          is_late?: boolean
          is_missing_checkout?: boolean
          last_check_out_at?: string | null
          open_session?: boolean
          primary_status: string
          staff_id: string
          updated_at?: string
          worked_minutes?: number
        }
        Update: {
          attendance_date?: string
          attendance_policy_id?: string
          created_at?: string
          derived_at?: string
          first_check_in_at?: string | null
          has_manual_adjustment?: boolean
          is_early_checkout?: boolean
          is_late?: boolean
          is_missing_checkout?: boolean
          last_check_out_at?: string | null
          open_session?: boolean
          primary_status?: string
          staff_id?: string
          updated_at?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_days_attendance_policy_id_fkey"
            columns: ["attendance_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_days_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          attendance_date: string
          attendance_policy_id: string
          client_reported_at: string | null
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          latitude: number | null
          location_accuracy_m: number | null
          location_category: string | null
          longitude: number | null
          occurred_at: string
          staff_id: string
        }
        Insert: {
          attendance_date: string
          attendance_policy_id: string
          client_reported_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          latitude?: number | null
          location_accuracy_m?: number | null
          location_category?: string | null
          longitude?: number | null
          occurred_at?: string
          staff_id: string
        }
        Update: {
          attendance_date?: string
          attendance_policy_id?: string
          client_reported_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          location_category?: string | null
          longitude?: number | null
          occurred_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_attendance_policy_id_fkey"
            columns: ["attendance_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_policies: {
        Row: {
          code: string
          created_at: string
          half_day_threshold_minutes: number
          id: string
          is_current: boolean
          late_grace_minutes: number
          location_required: boolean
          missing_checkout_cutoff_local: string
          name: string
          supersedes_policy_id: string | null
          timezone: string
          weekly_off_days: number[]
          workday_end_local: string
          workday_start_local: string
        }
        Insert: {
          code: string
          created_at?: string
          half_day_threshold_minutes: number
          id?: string
          is_current?: boolean
          late_grace_minutes: number
          location_required: boolean
          missing_checkout_cutoff_local: string
          name: string
          supersedes_policy_id?: string | null
          timezone: string
          weekly_off_days: number[]
          workday_end_local: string
          workday_start_local: string
        }
        Update: {
          code?: string
          created_at?: string
          half_day_threshold_minutes?: number
          id?: string
          is_current?: boolean
          late_grace_minutes?: number
          location_required?: boolean
          missing_checkout_cutoff_local?: string
          name?: string
          supersedes_policy_id?: string | null
          timezone?: string
          weekly_off_days?: number[]
          workday_end_local?: string
          workday_start_local?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_policies_supersedes_policy_id_fkey"
            columns: ["supersedes_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_policies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kriti_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          error_code: string | null
          event_type: string
          id: string
          run_id: string
          usage_metadata: Json | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          error_code?: string | null
          event_type: string
          id?: string
          run_id: string
          usage_metadata?: Json | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          error_code?: string | null
          event_type?: string
          id?: string
          run_id?: string
          usage_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kriti_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kriti_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "kriti_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      kriti_runs: {
        Row: {
          actor_id: string
          context_digest: string
          context_provenance: Json
          created_at: string
          id: string
          model_name: string | null
          provider_code: string | null
          provider_mode: string
          status: string
          target_id: string | null
          target_type: string | null
          task_type: string
        }
        Insert: {
          actor_id: string
          context_digest: string
          context_provenance?: Json
          created_at?: string
          id: string
          model_name?: string | null
          provider_code?: string | null
          provider_mode: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          task_type: string
        }
        Update: {
          actor_id?: string
          context_digest?: string
          context_provenance?: Json
          created_at?: string
          id?: string
          model_name?: string | null
          provider_code?: string | null
          provider_mode?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kriti_runs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      lead_assignment_rules: {
        Row: {
          budget_comfort_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          locality_normalized: string | null
          priority: number
          service_code: string | null
          source_id: string
          target_user_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget_comfort_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          locality_normalized?: string | null
          priority: number
          service_code?: string | null
          source_id: string
          target_user_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget_comfort_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          locality_normalized?: string | null
          priority?: number
          service_code?: string | null
          source_id?: string
          target_user_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_rules_updated_by_fkey"
            columns: ["updated_by"]
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
      lead_import_batches: {
        Row: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        Insert: {
          approval_kind?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_request_id: string
          created_at?: string
          created_by: string
          default_source_id?: string | null
          duplicate_blocked_rows?: number
          failed_rows?: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint?: string | null
          id?: string
          import_completed_at?: string | null
          import_started_at?: string | null
          importable_rows?: number
          imported_rows?: number
          invalid_rows?: number
          mapping?: Json
          original_filename: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validation_revision?: number
          worksheet_name?: string | null
        }
        Update: {
          approval_kind?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_request_id?: string
          created_at?: string
          created_by?: string
          default_source_id?: string | null
          duplicate_blocked_rows?: number
          failed_rows?: number
          file_sha256?: string
          file_size_bytes?: number
          file_type?: string
          header_fingerprint?: string | null
          id?: string
          import_completed_at?: string | null
          import_started_at?: string | null
          importable_rows?: number
          imported_rows?: number
          invalid_rows?: number
          mapping?: Json
          original_filename?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validation_revision?: number
          worksheet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_batches_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_batches_default_source_id_fkey"
            columns: ["default_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_batches_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_events: {
        Row: {
          actor_id: string | null
          batch_id: string
          event_at: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          batch_id: string
          event_at?: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          batch_id?: string
          event_at?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_rows: {
        Row: {
          assignment_resolution_code: string | null
          assignment_rule_id: string | null
          batch_id: string
          budget_comfort_code: string | null
          created_at: string
          duplicate_outcome: string | null
          email: string | null
          id: string
          import_error_code: string | null
          import_status: string
          lead_id: string | null
          locality: string | null
          message: string | null
          phone: string | null
          primary_source_id: string | null
          property_code: string
          resolved_assignee_id: string | null
          room_codes: string[]
          row_number: number
          service_code: string
          source_detail: string | null
          submitted_name: string
          timeline_code: string
          updated_at: string
          validation_errors: Json
          validation_status: string
        }
        Insert: {
          assignment_resolution_code?: string | null
          assignment_rule_id?: string | null
          batch_id: string
          budget_comfort_code?: string | null
          created_at?: string
          duplicate_outcome?: string | null
          email?: string | null
          id?: string
          import_error_code?: string | null
          import_status?: string
          lead_id?: string | null
          locality?: string | null
          message?: string | null
          phone?: string | null
          primary_source_id?: string | null
          property_code: string
          resolved_assignee_id?: string | null
          room_codes?: string[]
          row_number: number
          service_code: string
          source_detail?: string | null
          submitted_name: string
          timeline_code: string
          updated_at?: string
          validation_errors?: Json
          validation_status?: string
        }
        Update: {
          assignment_resolution_code?: string | null
          assignment_rule_id?: string | null
          batch_id?: string
          budget_comfort_code?: string | null
          created_at?: string
          duplicate_outcome?: string | null
          email?: string | null
          id?: string
          import_error_code?: string | null
          import_status?: string
          lead_id?: string | null
          locality?: string | null
          message?: string | null
          phone?: string | null
          primary_source_id?: string | null
          property_code?: string
          resolved_assignee_id?: string | null
          room_codes?: string[]
          row_number?: number
          service_code?: string
          source_detail?: string | null
          submitted_name?: string
          timeline_code?: string
          updated_at?: string
          validation_errors?: Json
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lead_import_rows_assignment_rule"
            columns: ["assignment_rule_id"]
            isOneToOne: false
            referencedRelation: "lead_assignment_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_primary_source_id_fkey"
            columns: ["primary_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_resolved_assignee_id_fkey"
            columns: ["resolved_assignee_id"]
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
          landing_path: string | null
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string | null
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
          landing_path?: string | null
          locality?: string | null
          message?: string | null
          on_hold_previous_status?: string | null
          on_hold_reason?: string | null
          on_hold_since?: string | null
          planner_version?: string | null
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
          landing_path?: string | null
          locality?: string | null
          message?: string | null
          on_hold_previous_status?: string | null
          on_hold_reason?: string | null
          on_hold_since?: string | null
          planner_version?: string | null
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
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          half_day_part: string | null
          id: string
          leave_type_id: string
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          half_day_part?: string | null
          id?: string
          leave_type_id: string
          reason: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          half_day_part?: string | null
          id?: string
          leave_type_id?: string
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          allows_half_day: boolean
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          allows_half_day?: boolean
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
        }
        Update: {
          allows_half_day?: boolean
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
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
      quotation_events: {
        Row: {
          actor_id: string
          details: Json
          event_type: string
          id: string
          lead_id: string
          occurred_at: string
          quotation_id: string
          quotation_version_id: string | null
        }
        Insert: {
          actor_id: string
          details?: Json
          event_type: string
          id?: string
          lead_id: string
          occurred_at?: string
          quotation_id: string
          quotation_version_id?: string | null
        }
        Update: {
          actor_id?: string
          details?: Json
          event_type?: string
          id?: string
          lead_id?: string
          occurred_at?: string
          quotation_id?: string
          quotation_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_events_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_events_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          item_name: string
          line_total_paise: number
          quantity: number
          section_id: string
          specifications: string | null
          unit_of_measure: string
          unit_rate_paise: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          item_name: string
          line_total_paise: number
          quantity: number
          section_id: string
          specifications?: string | null
          unit_of_measure: string
          unit_rate_paise: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          item_name?: string
          line_total_paise?: number
          quantity?: number
          section_id?: string
          specifications?: string | null
          unit_of_measure?: string
          unit_rate_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quotation_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_payment_schedules: {
        Row: {
          amount_paise: number | null
          created_at: string
          id: string
          milestone_name: string
          milestone_order: number
          percentage: number | null
          quotation_version_id: string
        }
        Insert: {
          amount_paise?: number | null
          created_at?: string
          id?: string
          milestone_name: string
          milestone_order?: number
          percentage?: number | null
          quotation_version_id: string
        }
        Update: {
          amount_paise?: number | null
          created_at?: string
          id?: string
          milestone_name?: string
          milestone_order?: number
          percentage?: number | null
          quotation_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_payment_schedules_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          quotation_version_id: string
          section_name: string
          subtotal_paise: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          quotation_version_id: string
          section_name: string
          subtotal_paise?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          quotation_version_id?: string
          section_name?: string
          subtotal_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_sections_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_tax_profiles: {
        Row: {
          code: string
          created_at: string
          created_by: string
          display_name: string
          id: string
          is_active: boolean
          rate_percentage: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          display_name: string
          id?: string
          is_active?: boolean
          rate_percentage: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          display_name?: string
          id?: string
          is_active?: boolean
          rate_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_tax_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_tax_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_versions: {
        Row: {
          client_email_snapshot: string | null
          client_name_snapshot: string | null
          client_phone_snapshot: string | null
          created_at: string
          created_by: string
          discount_percentage: number
          discount_total_paise: number
          discount_type: string
          discount_value_paise: number
          exclusions: string[]
          grand_total_paise: number | null
          id: string
          inclusions: string[]
          is_current_draft: boolean
          lock_version: number
          payment_schedule_mode: string | null
          property_address_snapshot: string | null
          quotation_id: string
          scope_summary: string | null
          status: string
          subtotal_paise: number
          tax_profile_id: string | null
          tax_rate_percentage: number | null
          tax_total_paise: number | null
          taxable_base_paise: number
          terms_and_conditions: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version_number: number
        }
        Insert: {
          client_email_snapshot?: string | null
          client_name_snapshot?: string | null
          client_phone_snapshot?: string | null
          created_at?: string
          created_by: string
          discount_percentage?: number
          discount_total_paise?: number
          discount_type?: string
          discount_value_paise?: number
          exclusions?: string[]
          grand_total_paise?: number | null
          id?: string
          inclusions?: string[]
          is_current_draft?: boolean
          lock_version?: number
          payment_schedule_mode?: string | null
          property_address_snapshot?: string | null
          quotation_id: string
          scope_summary?: string | null
          status?: string
          subtotal_paise?: number
          tax_profile_id?: string | null
          tax_rate_percentage?: number | null
          tax_total_paise?: number | null
          taxable_base_paise?: number
          terms_and_conditions?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version_number: number
        }
        Update: {
          client_email_snapshot?: string | null
          client_name_snapshot?: string | null
          client_phone_snapshot?: string | null
          created_at?: string
          created_by?: string
          discount_percentage?: number
          discount_total_paise?: number
          discount_type?: string
          discount_value_paise?: number
          exclusions?: string[]
          grand_total_paise?: number | null
          id?: string
          inclusions?: string[]
          is_current_draft?: boolean
          lock_version?: number
          payment_schedule_mode?: string | null
          property_address_snapshot?: string | null
          quotation_id?: string
          scope_summary?: string | null
          status?: string
          subtotal_paise?: number
          tax_profile_id?: string | null
          tax_rate_percentage?: number | null
          tax_total_paise?: number | null
          taxable_base_paise?: number
          terms_and_conditions?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_versions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_versions_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "quotation_tax_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_versions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lead_id: string
          quotation_number: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          quotation_number: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          quotation_number?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      sales_target_events: {
        Row: {
          actor_id: string
          after_snapshot: Json
          before_snapshot: Json | null
          event_type: string
          id: string
          occurred_at: string
          reason: string
          revision: number
          target_id: string
        }
        Insert: {
          actor_id: string
          after_snapshot: Json
          before_snapshot?: Json | null
          event_type: string
          id?: string
          occurred_at?: string
          reason: string
          revision: number
          target_id: string
        }
        Update: {
          actor_id?: string
          after_snapshot?: Json
          before_snapshot?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string
          reason?: string
          revision?: number
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_target_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_target_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "sales_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          closed_won_count_target: number
          created_at: string
          created_by: string
          currency: string
          id: string
          last_reason: string
          revenue_target_paise: number
          revision: number
          status: string
          target_month: string
          target_scope: string
          target_user_id: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          closed_won_count_target: number
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          last_reason: string
          revenue_target_paise: number
          revision?: number
          status?: string
          target_month: string
          target_scope: string
          target_user_id?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          closed_won_count_target?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          last_reason?: string
          revenue_target_paise?: number
          revision?: number
          status?: string
          target_month?: string
          target_scope?: string
          target_user_id?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_admin_events: {
        Row: {
          actor_id: string
          created_at: string
          details: Json
          event_type: string
          id: string
          staff_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          staff_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_admin_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_admin_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_employment_profiles: {
        Row: {
          attendance_eligible: boolean
          attendance_policy_id: string | null
          created_at: string
          designation: string
          employee_code: string
          invite_reconciliation_state: string
          joining_date: string
          reporting_manager_id: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          attendance_eligible?: boolean
          attendance_policy_id?: string | null
          created_at?: string
          designation: string
          employee_code: string
          invite_reconciliation_state?: string
          joining_date: string
          reporting_manager_id?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          attendance_eligible?: boolean
          attendance_policy_id?: string | null
          created_at?: string
          designation?: string
          employee_code?: string
          invite_reconciliation_state?: string
          joining_date?: string
          reporting_manager_id?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_employment_profiles_attendance_policy_id_fkey"
            columns: ["attendance_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employment_profiles_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employment_profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_business_accounts: {
        Row: {
          created_at: string
          id: string
          provider: string
          status: string
          updated_at: string
          waba_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          waba_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          waba_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          contact_id: string | null
          created_at: string
          customer_e164: string
          display_name_snapshot: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          lead_id: string | null
          phone_number_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          customer_e164: string
          display_name_snapshot?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          phone_number_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          customer_e164?: string
          display_name_snapshot?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          phone_number_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_status_events: {
        Row: {
          created_at: string
          details: Json
          envelope_hash: string
          event_hash: string
          event_key: string
          id: string
          message_id: string | null
          provider_message_id: string
          provider_timestamp: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json
          envelope_hash: string
          event_hash: string
          event_key: string
          id?: string
          message_id?: string | null
          provider_message_id: string
          provider_timestamp: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json
          envelope_hash?: string
          event_hash?: string
          event_key?: string
          id?: string
          message_id?: string | null
          provider_message_id?: string
          provider_timestamp?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_status_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body_text: string | null
          content: Json
          context_provider_message_id: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          latest_status: string | null
          normalized_message_type: string
          provider_message_id: string
          provider_message_type: string
          provider_timestamp: string
          recipient_e164: string
          sender_e164: string
        }
        Insert: {
          body_text?: string | null
          content?: Json
          context_provider_message_id?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          latest_status?: string | null
          normalized_message_type: string
          provider_message_id: string
          provider_message_type: string
          provider_timestamp: string
          recipient_e164: string
          sender_e164: string
        }
        Update: {
          body_text?: string | null
          content?: Json
          context_provider_message_id?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          latest_status?: string | null
          normalized_message_type?: string
          provider_message_id?: string
          provider_message_type?: string
          provider_timestamp?: string
          recipient_e164?: string
          sender_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_phone_numbers: {
        Row: {
          business_account_id: string
          created_at: string
          display_phone_number: string | null
          id: string
          phone_number_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_account_id: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_account_id?: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_phone_numbers_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_provider_dispatch_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          created_at: string
          error_class: string | null
          http_status: number | null
          id: string
          provider_attempt_key: string
          provider_code: string
          provider_message_id: string | null
          request_snapshot: Json
          response_snapshot: Json
          send_intent_id: string
          status: string
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          error_class?: string | null
          http_status?: number | null
          id?: string
          provider_attempt_key: string
          provider_code: string
          provider_message_id?: string | null
          request_snapshot?: Json
          response_snapshot?: Json
          send_intent_id: string
          status?: string
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          error_class?: string | null
          http_status?: number | null
          id?: string
          provider_attempt_key?: string
          provider_code?: string
          provider_message_id?: string | null
          request_snapshot?: Json
          response_snapshot?: Json
          send_intent_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_provider_dispatch_attempts_send_intent_id_fkey"
            columns: ["send_intent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_send_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_intent_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          send_intent_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          send_intent_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          send_intent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_intent_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_intent_events_send_intent_id_fkey"
            columns: ["send_intent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_send_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_intents: {
        Row: {
          body_text: string
          conversation_id: string
          created_at: string
          dispatch_mode: string
          eligibility_code: string
          eligibility_snapshot: Json
          id: string
          idempotency_key: string
          lifecycle_status: string
          outbound_message_id: string | null
          purpose_code: string
          reply_to_message_id: string | null
          request_hash: string
          requested_by: string
          updated_at: string
        }
        Insert: {
          body_text: string
          conversation_id: string
          created_at?: string
          dispatch_mode?: string
          eligibility_code: string
          eligibility_snapshot?: Json
          id?: string
          idempotency_key: string
          lifecycle_status?: string
          outbound_message_id?: string | null
          purpose_code: string
          reply_to_message_id?: string | null
          request_hash: string
          requested_by: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          conversation_id?: string
          created_at?: string
          dispatch_mode?: string
          eligibility_code?: string
          eligibility_snapshot?: Json
          id?: string
          idempotency_key?: string
          lifecycle_status?: string
          outbound_message_id?: string | null
          purpose_code?: string
          reply_to_message_id?: string | null
          request_hash?: string
          requested_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_intents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_intents_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_intents_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_intents_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          business_account_id: string
          category: string
          components: Json
          created_at: string
          id: string
          language: string
          name: string
          provider_template_id: string | null
          provider_updated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_account_id: string
          category: string
          components?: Json
          created_at?: string
          id?: string
          language: string
          name: string
          provider_template_id?: string | null
          provider_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_account_id?: string
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          name?: string
          provider_template_id?: string | null
          provider_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          created_at: string
          envelope_hash: string
          event_hash: string
          event_key: string
          event_kind: string
          id: string
          outcome_code: string
          phone_number_id: string
          provider_message_id: string | null
          provider_timestamp: string | null
          received_at: string
          waba_id: string
        }
        Insert: {
          created_at?: string
          envelope_hash: string
          event_hash: string
          event_key: string
          event_kind: string
          id?: string
          outcome_code: string
          phone_number_id: string
          provider_message_id?: string | null
          provider_timestamp?: string | null
          received_at?: string
          waba_id: string
        }
        Update: {
          created_at?: string
          envelope_hash?: string
          event_hash?: string
          event_key?: string
          event_kind?: string
          id?: string
          outcome_code?: string
          phone_number_id?: string
          provider_message_id?: string | null
          provider_timestamp?: string | null
          received_at?: string
          waba_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_kriti_audit_event: {
        Args: {
          p_details?: Json
          p_error_code?: string
          p_event_type: string
          p_run_id: string
          p_run_status?: string
          p_usage_metadata?: Json
        }
        Returns: string
      }
      approve_lead_import_batch: {
        Args: { p_batch_id: string; p_expected_revision: number }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_leave_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: Json
      }
      archive_holiday: { Args: { p_holiday_id: string }; Returns: Json }
      archive_quotation_draft: {
        Args: { p_expected_lock_version: number; p_quotation_id: string }
        Returns: Json
      }
      assign_lead: {
        Args: {
          p_assignee_id: string
          p_enforce_expected_state?: boolean
          p_expected_assignee?: string
          p_expected_updated_at?: string
          p_lead_id: string
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
          landing_path: string | null
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string | null
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
      bind_whatsapp_send_intent_dispatch: {
        Args: {
          p_dispatch_attempt_id: string
          p_provider_message_id: string
          p_provider_timestamp?: string
        }
        Returns: {
          outbound_message_id: string
          outcome_code: string
          provider_message_id: string
          send_intent_id: string
        }[]
      }
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
      cancel_lead_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_leave_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      check_in_attendance: {
        Args: {
          p_client_reported_at?: string
          p_idempotency_key: string
          p_latitude?: number
          p_location_accuracy_m?: number
          p_location_category?: string
          p_longitude?: number
        }
        Returns: Json
      }
      check_manual_lead_duplicate: {
        Args: {
          p_email: string
          p_locality: string
          p_phone: string
          p_property_code: string
          p_service_code: string
        }
        Returns: {
          can_create: boolean
          can_override: boolean
          existing_lead_id: string
          outcome_code: string
        }[]
      }
      check_out_attendance: {
        Args: {
          p_client_reported_at?: string
          p_idempotency_key: string
          p_latitude?: number
          p_location_accuracy_m?: number
          p_location_category?: string
          p_longitude?: number
        }
        Returns: Json
      }
      claim_whatsapp_send_intent_for_dispatch: {
        Args: {
          p_provider_attempt_key: string
          p_provider_code: string
          p_send_intent_id: string
        }
        Returns: {
          body_text: string
          conversation_id: string
          customer_e164: string
          dispatch_attempt_id: string
          outcome_code: string
          phone_number_id: string
          requested_by: string
          send_intent_id: string
          sender_e164: string
        }[]
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
      confirm_lead_import_batch_direct: {
        Args: { p_batch_id: string; p_expected_revision: number }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      correct_attendance_day: {
        Args: {
          p_attendance_date: string
          p_correction_type: string
          p_details?: Json
          p_reason: string
          p_staff_id: string
        }
        Returns: Json
      }
      create_holiday: {
        Args: { p_holiday_date: string; p_name: string }
        Returns: Json
      }
      create_lead_assignment_rule: {
        Args: {
          p_budget_comfort_code?: string
          p_locality?: string
          p_priority: number
          p_service_code?: string
          p_source_id: string
          p_target_user_id: string
        }
        Returns: {
          budget_comfort_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          locality_normalized: string | null
          priority: number
          service_code: string | null
          source_id: string
          target_user_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_assignment_rules"
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
      create_lead_import_batch: {
        Args: {
          p_client_request_id: string
          p_default_source_id?: string
          p_file_sha256: string
          p_file_size_bytes: number
          p_file_type: string
          p_header_fingerprint?: string
          p_original_filename: string
          p_worksheet_name?: string
        }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
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
      create_leave_request: {
        Args: {
          p_end_date: string
          p_half_day_part?: string
          p_leave_type_id: string
          p_reason: string
          p_start_date: string
        }
        Returns: Json
      }
      create_manual_lead: {
        Args: {
          p_assignee_id?: string
          p_budget_comfort_code?: string
          p_duplicate_override?: boolean
          p_duplicate_override_reason?: string
          p_email: string
          p_locality?: string
          p_message?: string
          p_phone: string
          p_primary_source_id: string
          p_property_code: string
          p_room_codes?: string[]
          p_service_code: string
          p_source_detail?: string
          p_submitted_name: string
          p_timeline_code: string
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
          landing_path: string | null
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string | null
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
      create_quotation_draft: {
        Args: { p_idempotency_key: string; p_lead_id: string; p_title: string }
        Returns: Json
      }
      create_sales_target: {
        Args: {
          p_closed_won_count_target: number
          p_reason: string
          p_revenue_target_paise: number
          p_target_month: string
          p_target_scope: string
          p_target_user_id: string
        }
        Returns: {
          closed_won_count_target: number
          created_at: string
          created_by: string
          currency: string
          id: string
          last_reason: string
          revenue_target_paise: number
          revision: number
          status: string
          target_month: string
          target_scope: string
          target_user_id: string | null
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_member: {
        Args: { p_client_request_id: string }
        Returns: Json
      }
      create_whatsapp_service_send_intent: {
        Args: {
          p_body_text: string
          p_conversation_id: string
          p_idempotency_key: string
          p_purpose_code: string
          p_reply_to_message_id?: string
        }
        Returns: {
          body_text: string
          conversation_id: string
          created_at: string
          dispatch_mode: string
          eligibility_code: string
          eligibility_snapshot: Json
          id: string
          idempotency_key: string
          lifecycle_status: string
          outbound_message_id: string | null
          purpose_code: string
          reply_to_message_id: string | null
          request_hash: string
          requested_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "whatsapp_send_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_quotation_draft: { Args: { p_quotation_id: string }; Returns: Json }
      ingest_meta_whatsapp_message: {
        Args: {
          p_body_text: string
          p_content: Json
          p_context_provider_message_id: string
          p_customer_e164: string
          p_display_name_snapshot: string
          p_display_phone_number: string
          p_envelope_hash: string
          p_event_hash: string
          p_event_key: string
          p_normalized_message_type: string
          p_phone_number_id: string
          p_provider_message_id: string
          p_provider_message_type: string
          p_provider_timestamp: string
          p_recipient_e164: string
          p_waba_id: string
        }
        Returns: {
          conversation_id: string
          duplicate: boolean
          message_id: string
          outcome_code: string
          webhook_event_id: string
        }[]
      }
      ingest_meta_whatsapp_status: {
        Args: {
          p_details: Json
          p_display_phone_number: string
          p_envelope_hash: string
          p_event_hash: string
          p_event_key: string
          p_phone_number_id: string
          p_provider_message_id: string
          p_provider_timestamp: string
          p_status: string
          p_waba_id: string
        }
        Returns: {
          duplicate: boolean
          message_id: string
          outcome_code: string
          status_event_id: string
          webhook_event_id: string
        }[]
      }
      list_crm_assignable_executives: {
        Args: never
        Returns: {
          display_name: string
          role_code: string
          user_id: string
        }[]
      }
      lock_sales_target: {
        Args: {
          p_expected_revision: number
          p_reason: string
          p_target_id: string
        }
        Returns: {
          closed_won_count_target: number
          created_at: string
          created_by: string
          currency: string
          id: string
          last_reason: string
          revenue_target_paise: number
          revision: number
          status: string
          target_month: string
          target_scope: string
          target_user_id: string | null
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prepare_staff_invite_saga: {
        Args: {
          p_attendance_eligible: boolean
          p_attendance_policy_id: string
          p_client_request_id: string
          p_designation: string
          p_display_name: string
          p_email: string
          p_employee_code: string
          p_joining_date: string
          p_phone_e164: string
          p_reporting_manager_id: string
          p_role_code: string
        }
        Returns: Json
      }
      process_lead_import_batch: {
        Args: {
          p_batch_id: string
          p_expected_revision: number
          p_max_rows?: number
        }
        Returns: Json
      }
      publish_attendance_policy: {
        Args: {
          p_code: string
          p_half_day_threshold_minutes: number
          p_late_grace_minutes: number
          p_location_required: boolean
          p_missing_checkout_cutoff_local: string
          p_name: string
          p_supersedes_policy_id?: string
          p_timezone: string
          p_weekly_off_days: number[]
          p_workday_end_local: string
          p_workday_start_local: string
        }
        Returns: Json
      }
      reconcile_staff_invite: {
        Args: { p_client_request_id: string }
        Returns: Json
      }
      reconcile_whatsapp_dispatch_attempt: {
        Args: { p_dispatch_attempt_id: string; p_provider_message_id: string }
        Returns: {
          outbound_message_id: string
          outcome_code: string
          send_intent_id: string
        }[]
      }
      record_staff_invite_auth_success: {
        Args: { p_client_request_id: string; p_staff_id: string }
        Returns: Json
      }
      record_whatsapp_dispatch_attempt_outcome: {
        Args: {
          p_dispatch_attempt_id: string
          p_error_class?: string
          p_http_status?: number
          p_response_snapshot?: Json
          p_status: string
        }
        Returns: {
          lifecycle_status: string
          outcome_code: string
          send_intent_id: string
        }[]
      }
      reject_lead_import_batch: {
        Args: {
          p_batch_id: string
          p_expected_revision: number
          p_rejection_reason: string
        }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_leave_request: {
        Args: { p_note?: string; p_request_id: string }
        Returns: Json
      }
      reopen_sales_target: {
        Args: {
          p_expected_revision: number
          p_reason: string
          p_target_id: string
        }
        Returns: {
          closed_won_count_target: number
          created_at: string
          created_by: string
          currency: string
          id: string
          last_reason: string
          revenue_target_paise: number
          revision: number
          status: string
          target_month: string
          target_scope: string
          target_user_id: string | null
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_lead_import_mapping: {
        Args: {
          p_batch_id: string
          p_default_source_id?: string
          p_mapping: Json
        }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_lead_import_rows: {
        Args: { p_batch_id: string; p_rows: Json }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
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
      replace_quotation_payment_schedule: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key?: string
          p_milestones: Json
          p_mode: string
          p_quotation_id: string
        }
        Returns: Json
      }
      resend_staff_invite: {
        Args: { p_reason: string; p_staff_id: string }
        Returns: Json
      }
      revise_sales_target: {
        Args: {
          p_closed_won_count_target: number
          p_expected_revision: number
          p_reason: string
          p_revenue_target_paise: number
          p_target_id: string
        }
        Returns: {
          closed_won_count_target: number
          created_at: string
          created_by: string
          currency: string
          id: string
          last_reason: string
          revenue_target_paise: number
          revision: number
          status: string
          target_month: string
          target_scope: string
          target_user_id: string | null
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_quotation_draft_items: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key?: string
          p_quotation_id: string
          p_sections: Json
        }
        Returns: Json
      }
      set_current_attendance_policy: {
        Args: { p_policy_id: string }
        Returns: Json
      }
      set_lead_assignment_rule_active: {
        Args: { p_is_active: boolean; p_rule_id: string }
        Returns: {
          budget_comfort_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          locality_normalized: string | null
          priority: number
          service_code: string | null
          source_id: string
          target_user_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_assignment_rules"
          isOneToOne: true
          isSetofReturn: false
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
      set_staff_profile_status: {
        Args: { p_reason: string; p_staff_id: string; p_status: string }
        Returns: Json
      }
      set_staff_reporting_manager: {
        Args: { p_manager_id: string; p_reason: string; p_staff_id: string }
        Returns: Json
      }
      start_kriti_run: {
        Args: {
          p_context_digest: string
          p_context_provenance?: Json
          p_model_name: string
          p_provider_code: string
          p_provider_mode: string
          p_run_id: string
          p_target_id: string
          p_target_type: string
          p_task_type: string
        }
        Returns: string
      }
      submit_lead_import_batch: {
        Args: { p_batch_id: string; p_expected_revision: number }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
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
          landing_path: string | null
          locality: string | null
          message: string | null
          on_hold_previous_status: string | null
          on_hold_reason: string | null
          on_hold_since: string | null
          planner_version: string | null
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
      update_lead_assignment_rule: {
        Args: {
          p_budget_comfort_code?: string
          p_locality?: string
          p_priority?: number
          p_rule_id: string
          p_service_code?: string
          p_target_user_id?: string
        }
        Returns: {
          budget_comfort_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          locality_normalized: string | null
          priority: number
          service_code: string | null
          source_id: string
          target_user_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_assignment_rules"
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
      update_quotation_draft: {
        Args: {
          p_clear_tax_profile?: boolean
          p_discount_percentage?: number
          p_discount_type?: string
          p_discount_value_paise?: number
          p_exclusions?: string[]
          p_expected_lock_version: number
          p_idempotency_key?: string
          p_inclusions?: string[]
          p_quotation_id: string
          p_scope_summary?: string
          p_tax_profile_id?: string
          p_terms_and_conditions?: string
          p_title?: string
        }
        Returns: Json
      }
      update_staff_employment: {
        Args: {
          p_attendance_eligible?: boolean
          p_attendance_policy_id?: string
          p_designation?: string
          p_display_name?: string
          p_employee_code?: string
          p_joining_date?: string
          p_phone_e164?: string
          p_reason?: string
          p_staff_id: string
        }
        Returns: Json
      }
      validate_lead_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          approval_kind: string | null
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_request_id: string
          created_at: string
          created_by: string
          default_source_id: string | null
          duplicate_blocked_rows: number
          failed_rows: number
          file_sha256: string
          file_size_bytes: number
          file_type: string
          header_fingerprint: string | null
          id: string
          import_completed_at: string | null
          import_started_at: string | null
          importable_rows: number
          imported_rows: number
          invalid_rows: number
          mapping: Json
          original_filename: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_revision: number
          worksheet_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      whatsapp_inbox_check_conversation_access: {
        Args: { p_capability: string; p_conversation_id: string }
        Returns: boolean
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

