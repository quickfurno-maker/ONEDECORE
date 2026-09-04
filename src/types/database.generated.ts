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
      campaign_approvals: {
        Row: {
          campaign_version_id: string
          configuration_hash: string
          created_at: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          reason: string | null
          rule_hash: string
        }
        Insert: {
          campaign_version_id: string
          configuration_hash: string
          created_at?: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          reason?: string | null
          rule_hash: string
        }
        Update: {
          campaign_version_id?: string
          configuration_hash?: string
          created_at?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          reason?: string | null
          rule_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_approvals_campaign_version_id_fkey"
            columns: ["campaign_version_id"]
            isOneToOne: true
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_audience_rule_versions: {
        Row: {
          campaign_version_id: string
          created_at: string
          frozen_at: string | null
          frozen_by: string | null
          id: string
          rule_group: Json
          rule_hash: string
          updated_at: string
        }
        Insert: {
          campaign_version_id: string
          created_at?: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          rule_group: Json
          rule_hash: string
          updated_at?: string
        }
        Update: {
          campaign_version_id?: string
          created_at?: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          rule_group?: Json
          rule_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_audience_rule_versions_campaign_version_id_fkey"
            columns: ["campaign_version_id"]
            isOneToOne: true
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_audience_rule_versions_frozen_by_fkey"
            columns: ["frozen_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_conversion_feedback_events: {
        Row: {
          attribution_state: string
          campaign_run_id: string | null
          campaign_run_target_id: string | null
          conversion_occurred_at: string
          conversion_type: string
          created_at: string
          currency: string | null
          event_reference: string
          id: string
          lead_id: string | null
          metadata: Json
          provider_channel: string | null
          provider_error_code: string | null
          provider_submission_id: string | null
          provider_submission_state: string
          source_entity_id: string
          source_entity_type: string
          source_event_key: string
          updated_at: string
          value_minor: number | null
        }
        Insert: {
          attribution_state: string
          campaign_run_id?: string | null
          campaign_run_target_id?: string | null
          conversion_occurred_at: string
          conversion_type: string
          created_at?: string
          currency?: string | null
          event_reference: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          provider_channel?: string | null
          provider_error_code?: string | null
          provider_submission_id?: string | null
          provider_submission_state: string
          source_entity_id: string
          source_entity_type: string
          source_event_key: string
          updated_at?: string
          value_minor?: number | null
        }
        Update: {
          attribution_state?: string
          campaign_run_id?: string | null
          campaign_run_target_id?: string | null
          conversion_occurred_at?: string
          conversion_type?: string
          created_at?: string
          currency?: string | null
          event_reference?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          provider_channel?: string | null
          provider_error_code?: string | null
          provider_submission_id?: string | null
          provider_submission_state?: string
          source_entity_id?: string
          source_entity_type?: string
          source_event_key?: string
          updated_at?: string
          value_minor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_conversion_feedback_events_campaign_run_id_fkey"
            columns: ["campaign_run_id"]
            isOneToOne: false
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_conversion_feedback_events_campaign_run_target_id_fkey"
            columns: ["campaign_run_target_id"]
            isOneToOne: false
            referencedRelation: "campaign_run_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_conversion_feedback_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_execution_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          campaign_run_id: string
          campaign_run_operation_id: string | null
          campaign_run_target_id: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          outcome_code: string
          provider_object_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          campaign_run_id: string
          campaign_run_operation_id?: string | null
          campaign_run_target_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          outcome_code: string
          provider_object_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          campaign_run_id?: string
          campaign_run_operation_id?: string | null
          campaign_run_target_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          outcome_code?: string
          provider_object_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_execution_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_execution_events_campaign_run_id_fkey"
            columns: ["campaign_run_id"]
            isOneToOne: false
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_execution_events_campaign_run_operation_id_fkey"
            columns: ["campaign_run_operation_id"]
            isOneToOne: false
            referencedRelation: "campaign_run_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_execution_events_campaign_run_target_id_fkey"
            columns: ["campaign_run_target_id"]
            isOneToOne: false
            referencedRelation: "campaign_run_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metric_snapshots: {
        Row: {
          campaign_run_id: string
          campaign_run_target_id: string
          clicks: number
          created_at: string
          currency: string
          fetched_at: string
          id: string
          impressions: number
          metadata: Json
          provider_account_ref: string | null
          provider_channel: string
          provider_conversions: number
          provider_revision: string | null
          spend_minor: number
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          campaign_run_id: string
          campaign_run_target_id: string
          clicks: number
          created_at?: string
          currency: string
          fetched_at?: string
          id?: string
          impressions: number
          metadata?: Json
          provider_account_ref?: string | null
          provider_channel: string
          provider_conversions: number
          provider_revision?: string | null
          spend_minor: number
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          campaign_run_id?: string
          campaign_run_target_id?: string
          clicks?: number
          created_at?: string
          currency?: string
          fetched_at?: string
          id?: string
          impressions?: number
          metadata?: Json
          provider_account_ref?: string | null
          provider_channel?: string
          provider_conversions?: number
          provider_revision?: string | null
          spend_minor?: number
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metric_snapshots_campaign_run_id_fkey"
            columns: ["campaign_run_id"]
            isOneToOne: false
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metric_snapshots_campaign_run_target_id_fkey"
            columns: ["campaign_run_target_id"]
            isOneToOne: false
            referencedRelation: "campaign_run_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_run_operations: {
        Row: {
          attempt_count: number
          campaign_run_id: string
          campaign_run_target_id: string
          claim_expires_at: string | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          id: string
          last_error_code: string | null
          max_attempts: number
          next_attempt_at: string
          operation_key: string
          operation_state: string
          operation_type: string
          request_hash: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          campaign_run_id: string
          campaign_run_target_id: string
          claim_expires_at?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error_code?: string | null
          max_attempts?: number
          next_attempt_at?: string
          operation_key: string
          operation_state: string
          operation_type: string
          request_hash: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          campaign_run_id?: string
          campaign_run_target_id?: string
          claim_expires_at?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error_code?: string | null
          max_attempts?: number
          next_attempt_at?: string
          operation_key?: string
          operation_state?: string
          operation_type?: string
          request_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_run_operations_campaign_run_id_fkey"
            columns: ["campaign_run_id"]
            isOneToOne: false
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_run_operations_campaign_run_target_id_fkey"
            columns: ["campaign_run_target_id"]
            isOneToOne: false
            referencedRelation: "campaign_run_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_run_targets: {
        Row: {
          account_reference: string | null
          campaign_run_id: string
          created_at: string
          id: string
          last_synced_at: string | null
          provider_ad_group_id: string | null
          provider_ad_set_id: string | null
          provider_campaign_id: string | null
          provider_channel: string
          provider_status: string | null
          run_target_reference: string
          updated_at: string
        }
        Insert: {
          account_reference?: string | null
          campaign_run_id: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider_ad_group_id?: string | null
          provider_ad_set_id?: string | null
          provider_campaign_id?: string | null
          provider_channel: string
          provider_status?: string | null
          run_target_reference: string
          updated_at?: string
        }
        Update: {
          account_reference?: string | null
          campaign_run_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider_ad_group_id?: string | null
          provider_ad_set_id?: string | null
          provider_campaign_id?: string | null
          provider_channel?: string
          provider_status?: string | null
          run_target_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_run_targets_campaign_run_id_fkey"
            columns: ["campaign_run_id"]
            isOneToOne: true
            referencedRelation: "campaign_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_runs: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          audience_rule_hash: string
          campaign_version_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          configuration_hash: string
          created_at: string
          deferred_channels: string[]
          destination_snapshot: Json
          failed_at: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          lock_version: number
          paused_at: string | null
          provider_channel: string
          requested_at: string
          requested_by: string
          run_reference: string
          scheduled_for: string
          status: string
          targeting_mode: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          audience_rule_hash: string
          campaign_version_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          configuration_hash: string
          created_at?: string
          deferred_channels?: string[]
          destination_snapshot: Json
          failed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          lock_version?: number
          paused_at?: string | null
          provider_channel: string
          requested_at?: string
          requested_by: string
          run_reference: string
          scheduled_for?: string
          status: string
          targeting_mode: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          audience_rule_hash?: string
          campaign_version_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          configuration_hash?: string
          created_at?: string
          deferred_channels?: string[]
          destination_snapshot?: Json
          failed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          lock_version?: number
          paused_at?: string | null
          provider_channel?: string
          requested_at?: string
          requested_by?: string
          run_reference?: string
          scheduled_for?: string
          status?: string
          targeting_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_runs_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_runs_campaign_version_id_fkey"
            columns: ["campaign_version_id"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_runs_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_versions: {
        Row: {
          budget_snapshot: Json
          campaign_id: string
          configuration_hash: string | null
          created_at: string
          created_by: string
          creative_snapshot: Json
          destination_reference: string | null
          frozen_at: string | null
          id: string
          intended_channels: string[]
          intended_window_snapshot: Json
          lock_version: number
          requested_at: string | null
          requested_by: string | null
          status: string
          targeting_mode: string
          title: string
          updated_at: string
          version_number: number
        }
        Insert: {
          budget_snapshot: Json
          campaign_id: string
          configuration_hash?: string | null
          created_at?: string
          created_by: string
          creative_snapshot: Json
          destination_reference?: string | null
          frozen_at?: string | null
          id?: string
          intended_channels: string[]
          intended_window_snapshot: Json
          lock_version?: number
          requested_at?: string | null
          requested_by?: string | null
          status?: string
          targeting_mode: string
          title: string
          updated_at?: string
          version_number: number
        }
        Update: {
          budget_snapshot?: Json
          campaign_id?: string
          configuration_hash?: string | null
          created_at?: string
          created_by?: string
          creative_snapshot?: Json
          destination_reference?: string | null
          frozen_at?: string | null
          id?: string
          intended_channels?: string[]
          intended_window_snapshot?: Json
          lock_version?: number
          requested_at?: string | null
          requested_by?: string | null
          status?: string
          targeting_mode?: string
          title?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_versions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_versions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_reference: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          campaign_reference: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          campaign_reference?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_categories: {
        Row: {
          category_reference: string
          cod_allowed_override: boolean | null
          created_at: string
          created_by: string
          free_shipping_eligible_override: boolean | null
          id: string
          name: string
          parent_category_id: string | null
          seo_description: string | null
          seo_title: string | null
          shipping_charge_paise_override: number | null
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_reference: string
          cod_allowed_override?: boolean | null
          created_at?: string
          created_by: string
          free_shipping_eligible_override?: boolean | null
          id?: string
          name: string
          parent_category_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          shipping_charge_paise_override?: number | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_reference?: string
          cod_allowed_override?: boolean | null
          created_at?: string
          created_by?: string
          free_shipping_eligible_override?: boolean | null
          id?: string
          name?: string
          parent_category_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          shipping_charge_paise_override?: number | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "commerce_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_inventory: {
        Row: {
          available_qty: number | null
          reserved_qty: number
          stock_on_hand: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          available_qty?: number | null
          reserved_qty?: number
          stock_on_hand?: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          available_qty?: number | null
          reserved_qty?: number
          stock_on_hand?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_inventory_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_order_delivery: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          assembly_install_note: string | null
          city: string
          created_at: string
          email: string | null
          eta_max_days: number
          eta_min_days: number
          locality: string
          mobile_e164: string
          order_id: string
          pincode: string
          recipient_name: string
          serviceable_snapshot: boolean
          shipping_charge_paise: number
          state: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          assembly_install_note?: string | null
          city: string
          created_at?: string
          email?: string | null
          eta_max_days: number
          eta_min_days: number
          locality: string
          mobile_e164: string
          order_id: string
          pincode: string
          recipient_name: string
          serviceable_snapshot: boolean
          shipping_charge_paise: number
          state: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          assembly_install_note?: string | null
          city?: string
          created_at?: string
          email?: string | null
          eta_max_days?: number
          eta_min_days?: number
          locality?: string
          mobile_e164?: string
          order_id?: string
          pincode?: string
          recipient_name?: string
          serviceable_snapshot?: boolean
          shipping_charge_paise?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_order_events: {
        Row: {
          actor_kind: string
          actor_profile_id: string | null
          created_at: string
          event_code: string
          from_status: string | null
          id: string
          metadata: Json
          order_id: string
          to_status: string | null
        }
        Insert: {
          actor_kind: string
          actor_profile_id?: string | null
          created_at?: string
          event_code: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id: string
          to_status?: string | null
        }
        Update: {
          actor_kind?: string
          actor_profile_id?: string | null
          created_at?: string
          event_code?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_order_items: {
        Row: {
          availability_mode: string
          compare_at_unit_price_paise: number | null
          created_at: string
          discount_paise: number
          hsn_sac_code: string | null
          id: string
          line_number: number
          line_total_paise: number
          option_values: Json
          order_id: string
          primary_image_public_path: string | null
          product_id: string
          product_name: string
          product_reference: string
          product_slug: string
          quantity: number
          selling_unit_price_paise: number
          sku: string
          tax_paise: number
          tax_rate_basis_points: number
          tax_rate_code: string
          taxable_paise: number
          variant_display_name: string | null
          variant_id: string
        }
        Insert: {
          availability_mode: string
          compare_at_unit_price_paise?: number | null
          created_at?: string
          discount_paise?: number
          hsn_sac_code?: string | null
          id?: string
          line_number: number
          line_total_paise: number
          option_values?: Json
          order_id: string
          primary_image_public_path?: string | null
          product_id: string
          product_name: string
          product_reference: string
          product_slug: string
          quantity: number
          selling_unit_price_paise: number
          sku: string
          tax_paise: number
          tax_rate_basis_points: number
          tax_rate_code: string
          taxable_paise: number
          variant_display_name?: string | null
          variant_id: string
        }
        Update: {
          availability_mode?: string
          compare_at_unit_price_paise?: number | null
          created_at?: string
          discount_paise?: number
          hsn_sac_code?: string | null
          id?: string
          line_number?: number
          line_total_paise?: number
          option_values?: Json
          order_id?: string
          primary_image_public_path?: string | null
          product_id?: string
          product_name?: string
          product_reference?: string
          product_slug?: string
          quantity?: number
          selling_unit_price_paise?: number
          sku?: string
          tax_paise?: number
          tax_rate_basis_points?: number
          tax_rate_code?: string
          taxable_paise?: number
          variant_display_name?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "commerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_orders: {
        Row: {
          cancellation_reason_code: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          contact_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_mobile_e164: string
          customer_name: string
          delivered_at: string | null
          discount_paise: number
          fulfilment_tracking_reference: string | null
          id: string
          inventory_hold_expires_at: string | null
          order_reference: string
          payment_method: string
          processing_at: string | null
          shipped_at: string | null
          shipping_paise: number
          status: string
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at: string
        }
        Insert: {
          cancellation_reason_code?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_mobile_e164: string
          customer_name: string
          delivered_at?: string | null
          discount_paise?: number
          fulfilment_tracking_reference?: string | null
          id?: string
          inventory_hold_expires_at?: string | null
          order_reference: string
          payment_method: string
          processing_at?: string | null
          shipped_at?: string | null
          shipping_paise: number
          status: string
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at?: string
        }
        Update: {
          cancellation_reason_code?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_mobile_e164?: string
          customer_name?: string
          delivered_at?: string | null
          discount_paise?: number
          fulfilment_tracking_reference?: string | null
          id?: string
          inventory_hold_expires_at?: string | null
          order_reference?: string
          payment_method?: string
          processing_at?: string | null
          shipped_at?: string | null
          shipping_paise?: number
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_pincodes: {
        Row: {
          eta_max_days: number
          eta_min_days: number
          pincode: string
          serviceable: boolean
          updated_at: string
          updated_by: string | null
          zone_code: string | null
        }
        Insert: {
          eta_max_days?: number
          eta_min_days?: number
          pincode: string
          serviceable: boolean
          updated_at?: string
          updated_by?: string | null
          zone_code?: string | null
        }
        Update: {
          eta_max_days?: number
          eta_min_days?: number
          pincode?: string
          serviceable?: boolean
          updated_at?: string
          updated_by?: string | null
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_pincodes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_media: {
        Row: {
          alt_text: string
          created_at: string
          created_by: string
          id: string
          is_primary: boolean
          original_bucket: string
          original_path: string
          product_id: string
          public_bucket: string
          public_path: string
          sort_order: number
          status: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          created_by: string
          id?: string
          is_primary?: boolean
          original_bucket?: string
          original_path: string
          product_id: string
          public_bucket?: string
          public_path: string
          sort_order?: number
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          created_by?: string
          id?: string
          is_primary?: boolean
          original_bucket?: string
          original_path?: string
          product_id?: string
          public_bucket?: string
          public_path?: string
          sort_order?: number
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "commerce_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_specifications: {
        Row: {
          created_at: string
          created_by: string
          id: string
          product_id: string
          sort_order: number
          specification_key: string
          specification_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          product_id: string
          sort_order?: number
          specification_key: string
          specification_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          product_id?: string
          sort_order?: number
          specification_key?: string
          specification_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_specifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_specifications_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_variants: {
        Row: {
          availability_mode: string
          compare_at_price_paise: number | null
          created_at: string
          created_by: string
          display_name: string | null
          id: string
          option_values: Json
          product_id: string
          selling_price_paise: number
          sku: string
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          availability_mode?: string
          compare_at_price_paise?: number | null
          created_at?: string
          created_by: string
          display_name?: string | null
          id?: string
          option_values?: Json
          product_id: string
          selling_price_paise: number
          sku: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          availability_mode?: string
          compare_at_price_paise?: number | null
          created_at?: string
          created_by?: string
          display_name?: string | null
          id?: string
          option_values?: Json
          product_id?: string
          selling_price_paise?: number
          sku?: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_variants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_variants_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_products: {
        Row: {
          archived_at: string | null
          category_id: string
          cod_allowed_override: boolean | null
          created_at: string
          created_by: string
          featured: boolean
          free_shipping_eligible_override: boolean | null
          full_description: string
          hsn_sac_code: string | null
          id: string
          lock_version: number
          name: string
          product_reference: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          shipping_charge_paise_override: number | null
          short_description: string | null
          slug: string
          status: string
          tax_rate_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          cod_allowed_override?: boolean | null
          created_at?: string
          created_by: string
          featured?: boolean
          free_shipping_eligible_override?: boolean | null
          full_description?: string
          hsn_sac_code?: string | null
          id?: string
          lock_version?: number
          name: string
          product_reference: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          shipping_charge_paise_override?: number | null
          short_description?: string | null
          slug: string
          status?: string
          tax_rate_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          cod_allowed_override?: boolean | null
          created_at?: string
          created_by?: string
          featured?: boolean
          free_shipping_eligible_override?: boolean | null
          full_description?: string
          hsn_sac_code?: string | null
          id?: string
          lock_version?: number
          name?: string
          product_reference?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          shipping_charge_paise_override?: number | null
          short_description?: string | null
          slug?: string
          status?: string
          tax_rate_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "commerce_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_products_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "commerce_tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_related_products: {
        Row: {
          product_id: string
          related_product_id: string
          sort_order: number
        }
        Insert: {
          product_id: string
          related_product_id: string
          sort_order?: number
        }
        Update: {
          product_id?: string
          related_product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "commerce_related_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_related_products_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "commerce_products"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_shipping_settings: {
        Row: {
          assembly_install_note: string | null
          cod_enabled_global: boolean
          default_shipping_charge_paise: number
          free_shipping_threshold_paise: number | null
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assembly_install_note?: string | null
          cod_enabled_global?: boolean
          default_shipping_charge_paise?: number
          free_shipping_threshold_paise?: number | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assembly_install_note?: string | null
          cod_enabled_global?: boolean
          default_shipping_charge_paise?: number
          free_shipping_threshold_paise?: number | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_shipping_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_tax_rates: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rate_basis_points: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate_basis_points: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate_basis_points?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_tax_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_tax_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_tax_settings: {
        Row: {
          gst_inclusive_display: boolean
          id: number
          tax_required_for_publish: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          gst_inclusive_display?: boolean
          id?: number
          tax_required_for_publish?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          gst_inclusive_display?: boolean
          id?: number
          tax_required_for_publish?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_tax_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      crm_cadence_enrollment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          enrollment_id: string
          event_type: string
          follow_up_id: string | null
          id: string
          lead_id: string
          new_values: Json
          previous_values: Json
          reason_code: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          enrollment_id: string
          event_type: string
          follow_up_id?: string | null
          id?: string
          lead_id: string
          new_values?: Json
          previous_values?: Json
          reason_code?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          enrollment_id?: string
          event_type?: string
          follow_up_id?: string | null
          id?: string
          lead_id?: string
          new_values?: Json
          previous_values?: Json
          reason_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadence_enrollment_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_enrollment_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_cadence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_enrollment_events_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_enrollment_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadence_steps: {
        Row: {
          activity_type: string
          created_at: string
          delay_hours: number
          duration_minutes: number | null
          id: string
          priority: string
          reminder_offset_minutes: number | null
          step_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          delay_hours: number
          duration_minutes?: number | null
          id?: string
          priority?: string
          reminder_offset_minutes?: number | null
          step_order: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          delay_hours?: number
          duration_minutes?: number | null
          id?: string
          priority?: string
          reminder_offset_minutes?: number | null
          step_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_cadence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadence_templates: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadence_templates_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_templates_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_cadence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step_order: number | null
          enrolled_at: string
          enrolled_by: string
          id: string
          lead_id: string
          paused_at: string | null
          status: string
          stop_reason: string | null
          stopped_at: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step_order?: number | null
          enrolled_at?: string
          enrolled_by: string
          id?: string
          lead_id: string
          paused_at?: string | null
          status?: string
          stop_reason?: string | null
          stopped_at?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step_order?: number | null
          enrolled_at?: string
          enrolled_by?: string
          id?: string
          lead_id?: string
          paused_at?: string | null
          status?: string
          stop_reason?: string | null
          stopped_at?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_cadence_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_cadence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_cadence_enrollments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_cadence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sla_clocks: {
        Row: {
          breached_at: string | null
          clock_started_at: string
          created_at: string
          first_contact_attempt_at: string | null
          lead_id: string
          policy_code: string
          sla_due_at: string | null
          updated_at: string
        }
        Insert: {
          breached_at?: string | null
          clock_started_at: string
          created_at?: string
          first_contact_attempt_at?: string | null
          lead_id: string
          policy_code: string
          sla_due_at?: string | null
          updated_at?: string
        }
        Update: {
          breached_at?: string | null
          clock_started_at?: string
          created_at?: string
          first_contact_attempt_at?: string | null
          lead_id?: string
          policy_code?: string
          sla_due_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sla_clocks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sla_clocks_policy_code_fkey"
            columns: ["policy_code"]
            isOneToOne: false
            referencedRelation: "crm_sla_policies"
            referencedColumns: ["policy_code"]
          },
        ]
      }
      crm_sla_policies: {
        Row: {
          activated_at: string | null
          business_hours_config: Json | null
          business_hours_enabled: boolean
          created_at: string
          effective_from: string | null
          is_active: boolean
          policy_code: string
          target_business_minutes: number
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          business_hours_config?: Json | null
          business_hours_enabled?: boolean
          created_at?: string
          effective_from?: string | null
          is_active?: boolean
          policy_code: string
          target_business_minutes: number
          timezone: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          business_hours_config?: Json | null
          business_hours_enabled?: boolean
          created_at?: string
          effective_from?: string | null
          is_active?: boolean
          policy_code?: string
          target_business_minutes?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sla_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      landing_experiment_variants: {
        Row: {
          allocation_percent: number
          created_at: string
          experiment_id: string
          id: string
          label: string
          landing_page_version_id: string
          variant_key: string
        }
        Insert: {
          allocation_percent: number
          created_at?: string
          experiment_id: string
          id?: string
          label: string
          landing_page_version_id: string
          variant_key: string
        }
        Update: {
          allocation_percent?: number
          created_at?: string
          experiment_id?: string
          id?: string
          label?: string
          landing_page_version_id?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "landing_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_experiment_variants_landing_page_version_id_fkey"
            columns: ["landing_page_version_id"]
            isOneToOne: false
            referencedRelation: "landing_page_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_experiments: {
        Row: {
          concluded_at: string | null
          concluded_by: string | null
          created_at: string
          created_by: string
          experiment_reference: string
          id: string
          publication_id: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
          winner_variant_key: string | null
        }
        Insert: {
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by: string
          experiment_reference: string
          id?: string
          publication_id: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
          winner_variant_key?: string | null
        }
        Update: {
          concluded_at?: string | null
          concluded_by?: string | null
          created_at?: string
          created_by?: string
          experiment_reference?: string
          id?: string
          publication_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
          winner_variant_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_experiments_concluded_by_fkey"
            columns: ["concluded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_experiments_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "landing_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_experiments_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_exposures: {
        Row: {
          assignment_epoch: string
          created_at: string
          experiment_id: string | null
          experiment_id_key: string | null
          first_exposed_at: string
          id: string
          publication_id: string
          variant_key: string | null
          variant_key_norm: string | null
          visitor_key_hash: string
        }
        Insert: {
          assignment_epoch: string
          created_at?: string
          experiment_id?: string | null
          experiment_id_key?: string | null
          first_exposed_at?: string
          id?: string
          publication_id: string
          variant_key?: string | null
          variant_key_norm?: string | null
          visitor_key_hash: string
        }
        Update: {
          assignment_epoch?: string
          created_at?: string
          experiment_id?: string | null
          experiment_id_key?: string | null
          first_exposed_at?: string
          id?: string
          publication_id?: string
          variant_key?: string | null
          variant_key_norm?: string | null
          visitor_key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_exposures_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "landing_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_exposures_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "landing_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_versions: {
        Row: {
          blocks: Json
          content_hash: string | null
          created_at: string
          created_by: string
          frozen_at: string | null
          id: string
          label: string
          landing_page_id: string
          lock_version: number
          updated_at: string
          updated_by: string | null
          version_number: number
        }
        Insert: {
          blocks: Json
          content_hash?: string | null
          created_at?: string
          created_by: string
          frozen_at?: string | null
          id?: string
          label: string
          landing_page_id: string
          lock_version?: number
          updated_at?: string
          updated_by?: string | null
          version_number: number
        }
        Update: {
          blocks?: Json
          content_hash?: string | null
          created_at?: string
          created_by?: string
          frozen_at?: string | null
          id?: string
          label?: string
          landing_page_id?: string
          lock_version?: number
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_versions_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_versions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          created_at: string
          created_by: string
          id: string
          page_reference: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          page_reference: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          page_reference?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_publications: {
        Row: {
          archived_at: string | null
          campaign_reference: string | null
          campaign_version_number: number | null
          created_at: string
          created_by: string
          id: string
          landing_page_id: string
          landing_page_version_id: string
          lock_version: number
          paused_at: string | null
          publication_reference: string
          published_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          campaign_reference?: string | null
          campaign_version_number?: number | null
          created_at?: string
          created_by: string
          id?: string
          landing_page_id: string
          landing_page_version_id: string
          lock_version?: number
          paused_at?: string | null
          publication_reference: string
          published_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          campaign_reference?: string | null
          campaign_version_number?: number | null
          created_at?: string
          created_by?: string
          id?: string
          landing_page_id?: string
          landing_page_version_id?: string
          lock_version?: number
          paused_at?: string | null
          publication_reference?: string
          published_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_publications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_publications_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_publications_landing_page_version_id_fkey"
            columns: ["landing_page_version_id"]
            isOneToOne: false
            referencedRelation: "landing_page_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_publications_updated_by_fkey"
            columns: ["updated_by"]
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
      lead_activity_outcome_codes: {
        Row: {
          activity_types: string[]
          closes_contact_attempt: boolean
          code: string
          created_at: string
          display_name: string
          display_order: number
          is_active: boolean
        }
        Insert: {
          activity_types?: string[]
          closes_contact_attempt?: boolean
          code: string
          created_at?: string
          display_name: string
          display_order?: number
          is_active?: boolean
        }
        Update: {
          activity_types?: string[]
          closes_contact_attempt?: boolean
          code?: string
          created_at?: string
          display_name?: string
          display_order?: number
          is_active?: boolean
        }
        Relationships: []
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
      lead_follow_up_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          follow_up_id: string
          id: string
          lead_id: string
          new_values: Json
          previous_values: Json
          reason_code: string | null
          reason_note: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          follow_up_id: string
          id?: string
          lead_id: string
          new_values?: Json
          previous_values?: Json
          reason_code?: string | null
          reason_note?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          follow_up_id?: string
          id?: string
          lead_id?: string
          new_values?: Json
          previous_values?: Json
          reason_code?: string | null
          reason_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_up_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_events_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_ups: {
        Row: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          cadence_enrollment_id?: string | null
          cadence_step_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          created_by: string
          due_at: string
          duration_minutes?: number | null
          id?: string
          is_primary_next_action?: boolean
          lead_id: string
          outcome?: string | null
          outcome_code?: string | null
          owner_id: string
          priority?: string
          quotation_id?: string | null
          reminder_at?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          cadence_enrollment_id?: string | null
          cadence_step_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string
          due_at?: string
          duration_minutes?: number | null
          id?: string
          is_primary_next_action?: boolean
          lead_id?: string
          outcome?: string | null
          outcome_code?: string | null
          owner_id?: string
          priority?: string
          quotation_id?: string | null
          reminder_at?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_ups_cadence_enrollment_id_fkey"
            columns: ["cadence_enrollment_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_cadence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_cadence_step_id_fkey"
            columns: ["cadence_step_id"]
            isOneToOne: false
            referencedRelation: "crm_cadence_steps"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "lead_follow_ups_outcome_code_fkey"
            columns: ["outcome_code"]
            isOneToOne: false
            referencedRelation: "lead_activity_outcome_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lead_follow_ups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
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
          manual_sales_temperature: string | null
          manual_sales_temperature_reason: string | null
          manual_sales_temperature_set_at: string | null
          manual_sales_temperature_set_by: string | null
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
          manual_sales_temperature?: string | null
          manual_sales_temperature_reason?: string | null
          manual_sales_temperature_set_at?: string | null
          manual_sales_temperature_set_by?: string | null
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
          manual_sales_temperature?: string | null
          manual_sales_temperature_reason?: string | null
          manual_sales_temperature_set_at?: string | null
          manual_sales_temperature_set_by?: string | null
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
      project_design_deliverable_versions: {
        Row: {
          bucket_id: string
          created_at: string
          deliverable_key: string
          file_name: string
          file_sha256: string
          file_size_bytes: number
          id: string
          kind: string
          label: string
          mime_type: string
          object_path: string
          project_id: string
          ready_at: string | null
          supersedes_version_id: string | null
          upload_status: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          deliverable_key: string
          file_name: string
          file_sha256: string
          file_size_bytes: number
          id?: string
          kind: string
          label: string
          mime_type: string
          object_path: string
          project_id: string
          ready_at?: string | null
          supersedes_version_id?: string | null
          upload_status: string
          uploaded_by: string
          version_number: number
        }
        Update: {
          bucket_id?: string
          created_at?: string
          deliverable_key?: string
          file_name?: string
          file_sha256?: string
          file_size_bytes?: number
          id?: string
          kind?: string
          label?: string
          mime_type?: string
          object_path?: string
          project_id?: string
          ready_at?: string | null
          supersedes_version_id?: string | null
          upload_status?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_design_deliverable_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_deliverable_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "project_design_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_deliverable_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_design_evidence: {
        Row: {
          captured_at: string
          captured_by: string
          evidence_type: string
          file_sha256: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          note: string | null
          project_id: string
          source_reference: string
          source_type: string
          storage_object_path: string | null
        }
        Insert: {
          captured_at?: string
          captured_by: string
          evidence_type: string
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          note?: string | null
          project_id: string
          source_reference: string
          source_type: string
          storage_object_path?: string | null
        }
        Update: {
          captured_at?: string
          captured_by?: string
          evidence_type?: string
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          note?: string | null
          project_id?: string
          source_reference?: string
          source_type?: string
          storage_object_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_design_evidence_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_design_workflows: {
        Row: {
          completed_at: string | null
          held_from_state: string | null
          project_id: string
          revision_return_state: string | null
          started_at: string
          started_by: string
          state: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          held_from_state?: string | null
          project_id: string
          revision_return_state?: string | null
          started_at?: string
          started_by: string
          state: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          held_from_state?: string | null
          project_id?: string
          revision_return_state?: string | null
          started_at?: string
          started_by?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_design_workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_workflows_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_designer_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assignment_role: string
          designer_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          project_id: string
          reason: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assignment_role: string
          designer_id: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          project_id: string
          reason?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assignment_role?: string
          designer_id?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          project_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_designer_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_designer_assignments_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_designer_assignments_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_designer_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          details: Json
          event_type: string
          id: string
          lead_id: string
          occurred_at: string
          project_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind: string
          details?: Json
          event_type: string
          id?: string
          lead_id: string
          occurred_at?: string
          project_id: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          details?: Json
          event_type?: string
          id?: string
          lead_id?: string
          occurred_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_execution_evidence: {
        Row: {
          captured_at: string
          captured_by: string
          evidence_type: string
          file_sha256: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          note: string | null
          project_id: string
          snag_id: string | null
          source_reference: string
          source_type: string
          storage_object_path: string | null
          target_state: string | null
        }
        Insert: {
          captured_at?: string
          captured_by: string
          evidence_type: string
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          note?: string | null
          project_id: string
          snag_id?: string | null
          source_reference: string
          source_type: string
          storage_object_path?: string | null
          target_state?: string | null
        }
        Update: {
          captured_at?: string
          captured_by?: string
          evidence_type?: string
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          note?: string | null
          project_id?: string
          snag_id?: string | null
          source_reference?: string
          source_type?: string
          storage_object_path?: string | null
          target_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_execution_evidence_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_execution_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_execution_evidence_snag_id_fkey"
            columns: ["snag_id"]
            isOneToOne: false
            referencedRelation: "project_execution_snags"
            referencedColumns: ["id"]
          },
        ]
      }
      project_execution_snags: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_execution_snags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_execution_snags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_execution_snags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_execution_workflows: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          held_from_state: string | null
          hold_reason: string | null
          hold_reason_code: string | null
          project_id: string
          state: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          held_from_state?: string | null
          hold_reason?: string | null
          hold_reason_code?: string | null
          project_id: string
          state: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          held_from_state?: string | null
          hold_reason?: string | null
          hold_reason_code?: string | null
          project_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_execution_workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_manager_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          ended_at: string | null
          ended_by: string | null
          id: string
          project_id: string
          project_manager_id: string
          reason: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          project_id: string
          project_manager_id: string
          reason?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          project_id?: string
          project_manager_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_manager_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_manager_assignments_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_manager_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_manager_assignments_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          accepted_quotation_id: string
          accepted_quotation_version_id: string
          created_at: string
          created_by: string | null
          handover_accepted_at: string | null
          id: string
          lead_id: string
          primary_pm_id: string | null
          project_number: string
          quotation_acceptance_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_quotation_id: string
          accepted_quotation_version_id: string
          created_at?: string
          created_by?: string | null
          handover_accepted_at?: string | null
          id?: string
          lead_id: string
          primary_pm_id?: string | null
          project_number: string
          quotation_acceptance_id: string
          status: string
          updated_at?: string
        }
        Update: {
          accepted_quotation_id?: string
          accepted_quotation_version_id?: string
          created_at?: string
          created_by?: string | null
          handover_accepted_at?: string | null
          id?: string
          lead_id?: string
          primary_pm_id?: string | null
          project_number?: string
          quotation_acceptance_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_accepted_quotation_id_fkey"
            columns: ["accepted_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_accepted_quotation_version_id_fkey"
            columns: ["accepted_quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_pm_id_fkey"
            columns: ["primary_pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quotation_acceptance_id_fkey"
            columns: ["quotation_acceptance_id"]
            isOneToOne: true
            referencedRelation: "quotation_acceptances"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_acceptances: {
        Row: {
          accepted_at: string
          accepted_by_email: string | null
          accepted_by_name: string
          access_grant_id: string
          created_at: string
          credited_sales_executive_id: string
          id: string
          lead_id: string
          quotation_id: string
          quotation_version_id: string
          sales_achievement_month: string
          taxable_base_paise: number
        }
        Insert: {
          accepted_at?: string
          accepted_by_email?: string | null
          accepted_by_name: string
          access_grant_id: string
          created_at?: string
          credited_sales_executive_id: string
          id?: string
          lead_id: string
          quotation_id: string
          quotation_version_id: string
          sales_achievement_month: string
          taxable_base_paise: number
        }
        Update: {
          accepted_at?: string
          accepted_by_email?: string | null
          accepted_by_name?: string
          access_grant_id?: string
          created_at?: string
          credited_sales_executive_id?: string
          id?: string
          lead_id?: string
          quotation_id?: string
          quotation_version_id?: string
          sales_achievement_month?: string
          taxable_base_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_acceptances_access_grant_id_fkey"
            columns: ["access_grant_id"]
            isOneToOne: false
            referencedRelation: "quotation_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_acceptances_credited_sales_executive_id_fkey"
            columns: ["credited_sales_executive_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_acceptances_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_acceptances_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_acceptances_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: true
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_access_grants: {
        Row: {
          capability_token_hash: string
          created_at: string
          created_by: string | null
          derivation_nonce: string
          expires_at: string | null
          id: string
          quotation_id: string
          quotation_version_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          capability_token_hash: string
          created_at?: string
          created_by?: string | null
          derivation_nonce: string
          expires_at?: string | null
          id: string
          quotation_id: string
          quotation_version_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          capability_token_hash?: string
          created_at?: string
          created_by?: string | null
          derivation_nonce?: string
          expires_at?: string | null
          id?: string
          quotation_id?: string
          quotation_version_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_access_grants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_access_grants_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_access_grants_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: false
            referencedRelation: "quotation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_access_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_commercial_settings: {
        Row: {
          max_discount_percentage: number
          setting_key: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          max_discount_percentage: number
          setting_key?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          max_discount_percentage?: number
          setting_key?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_commercial_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      quotation_pdf_documents: {
        Row: {
          bucket_id: string
          created_at: string
          created_by: string
          file_size_bytes: number | null
          id: string
          object_path: string
          pdf_sha256: string | null
          quotation_id: string
          quotation_version_id: string
          ready_at: string | null
          status: string
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          created_by: string
          file_size_bytes?: number | null
          id?: string
          object_path: string
          pdf_sha256?: string | null
          quotation_id: string
          quotation_version_id: string
          ready_at?: string | null
          status?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          created_by?: string
          file_size_bytes?: number | null
          id?: string
          object_path?: string
          pdf_sha256?: string | null
          quotation_id?: string
          quotation_version_id?: string
          ready_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_pdf_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_pdf_documents_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_pdf_documents_quotation_version_id_fkey"
            columns: ["quotation_version_id"]
            isOneToOne: true
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
          finalized_at: string | null
          finalized_by: string | null
          finalized_content_sha256: string | null
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
          tax_profile_snapshot: Json | null
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
          finalized_at?: string | null
          finalized_by?: string | null
          finalized_content_sha256?: string | null
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
          tax_profile_snapshot?: Json | null
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
          finalized_at?: string | null
          finalized_by?: string | null
          finalized_content_sha256?: string | null
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
          tax_profile_snapshot?: Json | null
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
            foreignKeyName: "quotation_versions_finalized_by_fkey"
            columns: ["finalized_by"]
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
          secure_content_kind: string | null
          secure_content_ref: string | null
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
          secure_content_kind?: string | null
          secure_content_ref?: string | null
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
          secure_content_kind?: string | null
          secure_content_ref?: string | null
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
          {
            foreignKeyName: "whatsapp_send_intents_secure_content_ref_fkey"
            columns: ["secure_content_ref"]
            isOneToOne: false
            referencedRelation: "quotation_access_grants"
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
      accept_project_handover: {
        Args: { p_idempotency_key: string; p_project_id: string }
        Returns: Json
      }
      accept_quotation_by_capability: {
        Args: {
          p_capability_token: string
          p_client_email?: string
          p_client_name: string
        }
        Returns: Json
      }
      add_project_supporting_designer: {
        Args: {
          p_designer_id: string
          p_idempotency_key: string
          p_project_id: string
          p_reason?: string
        }
        Returns: Json
      }
      adjust_commerce_inventory: {
        Args: {
          p_delta: number
          p_idempotency_key: string
          p_reason: string
          p_variant_id: string
        }
        Returns: Json
      }
      admin_create_quotation_tax_profile: {
        Args: {
          p_code: string
          p_display_name: string
          p_rate_percentage: number
        }
        Returns: Json
      }
      admin_update_quotation_tax_profile: {
        Args: {
          p_display_name: string
          p_is_active: boolean
          p_rate_percentage: number
          p_tax_profile_id: string
        }
        Returns: Json
      }
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
      approve_project_production_ready: {
        Args: {
          p_file_sha256?: string
          p_file_size_bytes?: number
          p_idempotency_key: string
          p_mime_type?: string
          p_note?: string
          p_project_id: string
          p_source_reference: string
          p_source_type: string
          p_storage_object_path?: string
        }
        Returns: Json
      }
      archive_cadence_template: {
        Args: { p_template_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_cadence_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_commerce_product: {
        Args: {
          p_expected_lock_version: number
          p_id: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      archive_commerce_product_media: {
        Args: { p_idempotency_key: string; p_media_id: string }
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
      assign_project_manager: {
        Args: {
          p_idempotency_key: string
          p_project_id: string
          p_project_manager_id: string
          p_reason?: string
        }
        Returns: Json
      }
      authorize: { Args: { requested_permission: string }; Returns: boolean }
      authorize_commerce_product_media_upload: {
        Args: {
          p_alt_text: string
          p_idempotency_key: string
          p_is_primary: boolean
          p_product_id: string
          p_sort_order: number
          p_variant_id: string | null
        }
        Returns: Json
      }
      bind_campaign_run_operation: {
        Args: {
          p_operation_id: string
          p_provider_ad_group_id?: string | null
          p_provider_ad_set_id?: string | null
          p_provider_campaign_id: string
          p_provider_status?: string | null
        }
        Returns: Json
      }
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
      can_approve_project_production_ready: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      can_complete_project_execution: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      can_record_project_client_approval: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      can_record_project_execution_handover: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      can_resolve_project_execution_snag: {
        Args: { p_snag_id: string }
        Returns: boolean
      }
      can_transition_project_execution: {
        Args: { p_project_id: string; p_target_state: string }
        Returns: boolean
      }
      can_view_project_design: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      can_view_project_execution_detail: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      can_view_project_handover_baseline: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      cancel_campaign_run: {
        Args: { p_campaign_run_id: string; p_idempotency_key: string }
        Returns: Json
      }
      cancel_commerce_order: {
        Args: {
          p_idempotency_key: string
          p_order_id: string
          p_reason_code: string
        }
        Returns: Json
      }
      cancel_lead_cadence: {
        Args: { p_enrollment_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step_order: number | null
          enrolled_at: string
          enrolled_by: string
          id: string
          lead_id: string
          paused_at: string | null
          status: string
          stop_reason: string | null
          stopped_at: string | null
          template_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_lead_cadence_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_lead_follow_up: {
        Args: { p_follow_up_id: string; p_outcome?: string }
        Returns: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
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
      cancel_project_execution: {
        Args: {
          p_idempotency_key: string
          p_project_id: string
          p_reason: string
        }
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
      check_public_commerce_pincode: {
        Args: { p_pincode: string }
        Returns: Json
      }
      claim_campaign_run_operation: {
        Args: { p_claim_ttl_seconds?: number; p_worker_id: string }
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
      complete_campaign_run_operation: {
        Args: {
          p_operation_id: string
          p_outcome_code: string
          p_safe_metadata?: Json
        }
        Returns: Json
      }
      complete_lead_activity: {
        Args: {
          p_activity_id: string
          p_closed_lost_reason?: string
          p_closure_reason_code?: string
          p_completion_note?: string
          p_next_activity_type?: string
          p_next_due_at?: string
          p_next_duration_minutes?: number
          p_next_priority?: string
          p_next_quotation_id?: string
          p_next_reminder_at?: string
          p_next_title?: string
          p_on_hold_reason?: string
          p_on_hold_review_at?: string
          p_outcome_code: string
          p_resolution?: string
          p_whatsapp_send_intent_id?: string
        }
        Returns: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
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
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_project_design: {
        Args: { p_idempotency_key: string; p_project_id: string }
        Returns: Json
      }
      complete_project_execution: {
        Args: {
          p_file_sha256?: string
          p_file_size_bytes?: number
          p_idempotency_key: string
          p_mime_type?: string
          p_note?: string
          p_project_id: string
          p_source_reference: string
          p_source_type: string
          p_storage_object_path?: string
        }
        Returns: Json
      }
      conclude_landing_experiment: {
        Args: {
          p_experiment_id: string
          p_idempotency_key: string
          p_winner_variant_key: string
        }
        Returns: Json
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
      consume_commerce_public_rate_limit: {
        Args: {
          p_network_fingerprint_hash: string
          p_operation: string
          p_phone_fingerprint_hash?: string
        }
        Returns: Json
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
      create_cadence_template: {
        Args: { p_description?: string; p_name: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_cadence_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_campaign_draft: {
        Args: {
          p_budget_snapshot: Json
          p_creative_snapshot: Json
          p_destination_reference: string
          p_idempotency_key: string
          p_intended_channels: string[]
          p_intended_window_snapshot: Json
          p_name: string
          p_rule_group: Json
          p_targeting_mode: string
          p_title: string
        }
        Returns: Json
      }
      create_campaign_run: {
        Args: { p_campaign_version_id: string; p_idempotency_key: string }
        Returns: Json
      }
      create_commerce_product: {
        Args: {
          p_category_id: string
          p_full_description: string
          p_idempotency_key: string
          p_name: string
          p_short_description: string
          p_slug: string
        }
        Returns: Json
      }
      create_holiday: {
        Args: { p_holiday_date: string; p_name: string }
        Returns: Json
      }
      create_landing_page_draft: {
        Args: {
          p_blocks: Json
          p_idempotency_key: string
          p_slug: string
          p_title: string
          p_version_label: string
        }
        Returns: Json
      }
      create_landing_publication: {
        Args: {
          p_campaign_reference: string | null
          p_campaign_version_number: number | null
          p_idempotency_key: string
          p_landing_page_id: string
          p_version_id: string
        }
        Returns: Json
      }
      create_lead_activity: {
        Args: {
          p_activity_type: string
          p_due_at: string
          p_duration_minutes?: number
          p_is_primary?: boolean
          p_lead_id: string
          p_owner_id?: string
          p_priority?: string
          p_quotation_id?: string
          p_reminder_at?: string
          p_title: string
        }
        Returns: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
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
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
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
      create_next_campaign_version: {
        Args: { p_campaign_id: string; p_idempotency_key: string }
        Returns: Json
      }
      create_next_landing_page_version: {
        Args: {
          p_idempotency_key: string
          p_landing_page_id: string
          p_source_version_id: string
        }
        Returns: Json
      }
      create_project_execution_snag: {
        Args: {
          p_description: string
          p_idempotency_key: string
          p_project_id: string
          p_title: string
        }
        Returns: Json
      }
      create_public_commerce_cod_order: {
        Args: {
          p_customer: Json
          p_delivery: Json
          p_idempotency_key: string
          p_lines: Json
        }
        Returns: Json
      }
      create_quotation_draft: {
        Args: { p_idempotency_key: string; p_lead_id: string; p_title: string }
        Returns: Json
      }
      create_quotation_revision: {
        Args: { p_idempotency_key?: string; p_source_version_id: string }
        Returns: Json
      }
      create_quotation_whatsapp_service_send_intent: {
        Args: {
          p_conversation_id: string
          p_grant_id: string
          p_idempotency_key: string
          p_version_id: string
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
          secure_content_kind: string | null
          secure_content_ref: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "whatsapp_send_intents"
          isOneToOne: true
          isSetofReturn: false
        }
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
          secure_content_kind: string | null
          secure_content_ref: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "whatsapp_send_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_campaign_version: {
        Args: {
          p_campaign_version_id: string
          p_decision: string
          p_idempotency_key: string
          p_reason: string
        }
        Returns: Json
      }
      designate_primary_next_action: {
        Args: { p_activity_id: string }
        Returns: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      duplicate_cadence_template: {
        Args: { p_name: string; p_template_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_cadence_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_campaign_conversion_feedback: {
        Args: { p_event_id: string }
        Returns: Json
      }
      enqueue_campaign_metrics_sync: {
        Args: { p_campaign_run_id: string; p_window_start?: string }
        Returns: Json
      }
      enqueue_pending_attributable_campaign_conversion_feedback: {
        Args: never
        Returns: Json
      }
      enroll_lead_in_cadence: {
        Args: { p_lead_id: string; p_template_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step_order: number | null
          enrolled_at: string
          enrolled_by: string
          id: string
          lead_id: string
          paused_at: string | null
          status: string
          stop_reason: string | null
          stopped_at: string | null
          template_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_lead_cadence_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_campaign_run_operation: {
        Args: {
          p_error_code: string
          p_operation_id: string
          p_retry?: boolean
        }
        Returns: Json
      }
      finalize_commerce_product_media: {
        Args: {
          p_idempotency_key: string
          p_media_id: string
          p_original_path: string
          p_public_path: string
        }
        Returns: Json
      }
      finalize_project_design_deliverable_version: {
        Args: { p_idempotency_key: string; p_version_id: string }
        Returns: Json
      }
      finalize_quotation_version: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key?: string
          p_quotation_id: string
          p_version_id: string
        }
        Returns: Json
      }
      freeze_landing_page_version: {
        Args: { p_idempotency_key: string; p_version_id: string }
        Returns: Json
      }
      get_campaign_metrics_board: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      get_campaign_run_operation_for_reconcile: {
        Args: { p_operation_id: string }
        Returns: Json
      }
      get_contact_marketing_consent_state: {
        Args: { p_contact_id: string }
        Returns: Json
      }
      get_crm_lead_commercial_state: {
        Args: { p_lead_id: string }
        Returns: Json
      }
      get_crm_lead_deal_values: {
        Args: { p_lead_ids: string[] }
        Returns: {
          commercial_state: string
          lead_id: string
          taxable_base_paise: number
        }[]
      }
      get_crm_management_analytics: {
        Args: {
          p_end: string
          p_owner_id?: string | null
          p_source_id?: string | null
          p_start: string
          p_target_month?: string | null
        }
        Returns: Json
      }
      get_crm_my_day: {
        Args: {
          p_attention_limit?: number
          p_owner_id?: string | null
          p_upcoming_limit?: number
        }
        Returns: Json
      }
      get_crm_pipeline_value_summary: {
        Args: { p_owner_id?: string | null }
        Returns: Json
      }
      get_live_landing_publication: { Args: { p_slug: string }; Returns: Json }
      get_project_design_high_level_status: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_project_execution_high_level_status: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_public_commerce_order_tracking_snapshot: {
        Args: { p_order_reference: string }
        Returns: Json
      }
      get_public_commerce_product: { Args: { p_slug: string }; Returns: Json }
      get_quotation_by_capability: {
        Args: { p_capability_token: string }
        Returns: Json
      }
      get_quotation_draft: { Args: { p_quotation_id: string }; Returns: Json }
      has_active_role: { Args: { p_role_code: string }; Returns: boolean }
      hold_project_design: {
        Args: {
          p_idempotency_key: string
          p_project_id: string
          p_reason: string
        }
        Returns: Json
      }
      hold_project_execution: {
        Args: {
          p_idempotency_key: string
          p_project_id: string
          p_reason: string
          p_reason_code: string
        }
        Returns: Json
      }
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
      issue_quotation_access_grant_internal: {
        Args: {
          p_actor_id: string
          p_capability_token_hash: string
          p_derivation_nonce: string
          p_grant_id: string
          p_reissue: boolean
          p_version_id: string
        }
        Returns: Json
      }
      list_assignable_designers: { Args: never; Returns: Json }
      list_assignable_project_managers: { Args: never; Returns: Json }
      list_crm_assignable_executives: {
        Args: never
        Returns: {
          display_name: string
          role_code: string
          user_id: string
        }[]
      }
      list_pending_closed_won_project_materializations: {
        Args: never
        Returns: Json
      }
      list_public_commerce_categories: { Args: never; Returns: Json }
      list_public_commerce_sitemap: { Args: never; Returns: Json }
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
      mark_campaign_conversion_feedback_state: {
        Args: {
          p_event_id: string
          p_provider_error_code?: string
          p_provider_submission_id?: string
          p_provider_submission_state: string
        }
        Returns: Json
      }
      mark_campaign_run_operation_needs_reconcile: {
        Args: { p_error_code?: string; p_operation_id: string }
        Returns: Json
      }
      mark_quotation_pdf_document_ready: {
        Args: {
          p_file_size_bytes: number
          p_object_path: string
          p_pdf_id: string
          p_pdf_sha256: string
        }
        Returns: Json
      }
      materialize_closed_won_project_internal: {
        Args: { p_idempotency_key: string; p_quotation_version_id: string }
        Returns: Json
      }
      pause_campaign_run: {
        Args: { p_campaign_run_id: string; p_idempotency_key: string }
        Returns: Json
      }
      pause_lead_cadence: {
        Args: { p_enrollment_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step_order: number | null
          enrolled_at: string
          enrolled_by: string
          id: string
          lead_id: string
          paused_at: string | null
          status: string
          stop_reason: string | null
          stopped_at: string | null
          template_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_lead_cadence_enrollments"
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
      preview_campaign_audience: {
        Args: { p_campaign_version_id: string }
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
      publish_cadence_template: {
        Args: { p_template_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_cadence_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_commerce_product: {
        Args: {
          p_expected_lock_version: number
          p_id: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      quote_public_commerce_cart: {
        Args: { p_lines: Json; p_payment_method?: string; p_pincode: string }
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
      record_landing_exposure: {
        Args: {
          p_assignment_epoch: string
          p_experiment_id: string | null
          p_publication_id: string
          p_variant_key: string | null
          p_visitor_key_hash: string
        }
        Returns: Json
      }
      record_marketing_consent_event: {
        Args: {
          p_channel: string
          p_contact_id: string
          p_copy_version: string
          p_event_type: string
          p_idempotency_key: string
          p_instruction_source: string
          p_note: string
          p_notice_version: string
        }
        Returns: Json
      }
      record_project_client_approval: {
        Args: {
          p_file_sha256?: string
          p_file_size_bytes?: number
          p_idempotency_key: string
          p_mime_type?: string
          p_note?: string
          p_project_id: string
          p_source_reference: string
          p_source_type: string
          p_storage_object_path?: string
        }
        Returns: Json
      }
      record_project_execution_handover: {
        Args: {
          p_file_sha256?: string
          p_file_size_bytes?: number
          p_idempotency_key: string
          p_mime_type?: string
          p_note?: string
          p_project_id: string
          p_source_reference: string
          p_source_type: string
          p_storage_object_path?: string
        }
        Returns: Json
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
      remove_project_designer_assignment: {
        Args: {
          p_designer_id: string
          p_idempotency_key: string
          p_project_id: string
          p_reason: string
        }
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
      repair_closed_won_project_materialization: {
        Args: { p_idempotency_key: string; p_quotation_version_id: string }
        Returns: Json
      }
      repair_project_execution_workflow: {
        Args: { p_idempotency_key: string; p_project_id: string }
        Returns: Json
      }
      replace_cadence_template_steps: {
        Args: { p_steps: Json; p_template_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_cadence_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_commerce_product_specifications: {
        Args: { p_idempotency_key: string; p_product_id: string; p_specs: Json }
        Returns: Json
      }
      replace_commerce_related_products: {
        Args: {
          p_idempotency_key: string
          p_product_id: string
          p_related_ids: string[]
        }
        Returns: Json
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
      request_campaign_approval: {
        Args: {
          p_campaign_version_id: string
          p_expected_lock_version: number
          p_idempotency_key: string
        }
        Returns: Json
      }
      reschedule_lead_activity: {
        Args: {
          p_activity_id: string
          p_clear_reminder?: boolean
          p_due_at: string
          p_reminder_at?: string
        }
        Returns: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resend_staff_invite: {
        Args: { p_reason: string; p_staff_id: string }
        Returns: Json
      }
      reserve_project_design_deliverable_version: {
        Args: {
          p_deliverable_key: string
          p_file_name: string
          p_file_sha256: string
          p_file_size_bytes: number
          p_idempotency_key: string
          p_kind: string
          p_label: string
          p_mime_type: string
          p_project_id: string
        }
        Returns: Json
      }
      reserve_quotation_pdf_document: {
        Args: { p_version_id: string }
        Returns: Json
      }
      resolve_campaign_run_create_reconcile_found: {
        Args: {
          p_operation_id: string
          p_provider_ad_group_id?: string
          p_provider_ad_set_id?: string
          p_provider_campaign_id: string
          p_provider_status?: string
        }
        Returns: Json
      }
      resolve_project_execution_snag: {
        Args: {
          p_file_sha256?: string
          p_file_size_bytes?: number
          p_idempotency_key: string
          p_mime_type?: string
          p_note?: string
          p_snag_id: string
          p_source_reference: string
          p_source_type: string
          p_storage_object_path?: string
        }
        Returns: Json
      }
      resume_campaign_run: {
        Args: { p_campaign_run_id: string; p_idempotency_key: string }
        Returns: Json
      }
      resume_lead_cadence: {
        Args: { p_enrollment_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          current_step_order: number | null
          enrolled_at: string
          enrolled_by: string
          id: string
          lead_id: string
          paused_at: string | null
          status: string
          stop_reason: string | null
          stopped_at: string | null
          template_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_lead_cadence_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resume_project_design: {
        Args: {
          p_idempotency_key: string
          p_project_id: string
          p_reason: string
        }
        Returns: Json
      }
      resume_project_execution: {
        Args: { p_idempotency_key: string; p_project_id: string }
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
      revoke_quotation_access_grant: {
        Args: { p_grant_id: string; p_reason?: string }
        Returns: Json
      }
      set_lead_sales_temperature: {
        Args: { p_lead_id: string; p_reason?: string; p_temperature: string }
        Returns: Database["public"]["Tables"]["leads"]["Row"]
      }
      save_campaign_draft: {
        Args: {
          p_budget_snapshot: Json
          p_campaign_version_id: string
          p_creative_snapshot: Json
          p_destination_reference: string
          p_expected_lock_version: number
          p_idempotency_key: string
          p_intended_channels: string[]
          p_intended_window_snapshot: Json
          p_rule_group: Json
          p_targeting_mode: string
          p_title: string
        }
        Returns: Json
      }
      save_landing_experiment_draft: {
        Args: {
          p_experiment_id: string | null
          p_idempotency_key: string
          p_publication_id: string
          p_variants: Json
        }
        Returns: Json
      }
      save_landing_page_draft: {
        Args: {
          p_blocks: Json
          p_expected_lock_version: number
          p_idempotency_key: string
          p_slug: string
          p_title: string
          p_version_id: string
          p_version_label: string
        }
        Returns: Json
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
      search_public_commerce_products: {
        Args: {
          p_availability_mode: string
          p_category_slug: string
          p_featured_only: boolean
          p_limit: number
          p_max_price_paise: number
          p_min_price_paise: number
          p_offset: number
          p_query: string
          p_sort: string
        }
        Returns: Json
      }
      set_commerce_category_status: {
        Args: { p_id: string; p_idempotency_key: string; p_status: string }
        Returns: Json
      }
      set_commerce_variant_status: {
        Args: { p_id: string; p_idempotency_key: string; p_status: string }
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
      set_project_lead_designer: {
        Args: {
          p_designer_id: string
          p_idempotency_key: string
          p_project_id: string
          p_reason?: string
        }
        Returns: Json
      }
      set_quotation_max_discount: {
        Args: { p_max_discount: number }
        Returns: Json
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
      start_landing_experiment: {
        Args: { p_experiment_id: string; p_idempotency_key: string }
        Returns: Json
      }
      start_project_execution_snag: {
        Args: { p_idempotency_key: string; p_snag_id: string }
        Returns: Json
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
      transfer_activity_ownership: {
        Args: { p_activity_id: string; p_new_owner_id: string }
        Returns: {
          activity_type: string
          cadence_enrollment_id: string | null
          cadence_step_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          due_at: string
          duration_minutes: number | null
          id: string
          is_primary_next_action: boolean
          lead_id: string
          outcome: string | null
          outcome_code: string | null
          owner_id: string
          priority: string
          quotation_id: string | null
          reminder_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lead_follow_ups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_commerce_order_fulfilment: {
        Args: {
          p_fulfilment_tracking_reference: string
          p_idempotency_key: string
          p_order_id: string
          p_to_status: string
        }
        Returns: Json
      }
      transition_landing_publication: {
        Args: {
          p_expected_lock_version: number
          p_idempotency_key: string
          p_publication_id: string
          p_target_status: string
        }
        Returns: Json
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
      transition_project_design: {
        Args: {
          p_idempotency_key: string
          p_project_id: string
          p_reason?: string
          p_revision_return_state?: string
          p_target_state: string
        }
        Returns: Json
      }
      transition_project_execution: {
        Args: {
          p_file_sha256?: string
          p_file_size_bytes?: number
          p_idempotency_key: string
          p_mime_type?: string
          p_note?: string
          p_project_id: string
          p_source_reference?: string
          p_source_type?: string
          p_storage_object_path?: string
          p_target_state: string
        }
        Returns: Json
      }
      update_cadence_template: {
        Args: { p_description?: string; p_name: string; p_template_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_cadence_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_commerce_product: {
        Args: {
          p_category_id: string
          p_cod_allowed_override: boolean
          p_expected_lock_version: number
          p_featured: boolean
          p_free_shipping_eligible_override: boolean
          p_full_description: string
          p_hsn_sac_code: string
          p_id: string
          p_idempotency_key: string
          p_name: string
          p_seo_description: string
          p_seo_title: string
          p_shipping_charge_paise_override: number
          p_short_description: string
          p_slug: string
          p_tax_rate_id: string
        }
        Returns: Json
      }
      update_commerce_shipping_settings: {
        Args: {
          p_assembly_install_note: string
          p_cod_enabled_global: boolean
          p_default_shipping_charge_paise: number
          p_free_shipping_threshold_paise: number
          p_idempotency_key: string
        }
        Returns: Json
      }
      update_commerce_tax_settings: {
        Args: { p_idempotency_key: string; p_tax_required_for_publish: boolean }
        Returns: Json
      }
      update_crm_sla_policy: {
        Args: {
          p_business_hours_config?: Json
          p_business_hours_enabled?: boolean
          p_clear_business_hours_config?: boolean
          p_is_active?: boolean
          p_policy_code: string
          p_target_business_minutes?: number
          p_timezone?: string
        }
        Returns: {
          activated_at: string | null
          business_hours_config: Json | null
          business_hours_enabled: boolean
          created_at: string
          effective_from: string | null
          is_active: boolean
          policy_code: string
          target_business_minutes: number
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_sla_policies"
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
      upsert_campaign_metric_snapshot: {
        Args: {
          p_campaign_run_target_id: string
          p_clicks: number
          p_currency: string
          p_impressions: number
          p_provider_account_ref?: string
          p_provider_conversions: number
          p_provider_revision?: string
          p_spend_minor: number
          p_window_end: string
          p_window_start: string
        }
        Returns: Json
      }
      upsert_commerce_category: {
        Args: {
          p_cod_allowed_override: boolean
          p_free_shipping_eligible_override: boolean
          p_id: string
          p_idempotency_key: string
          p_name: string
          p_parent_id: string
          p_seo_description: string
          p_seo_title: string
          p_shipping_charge_paise_override: number
          p_short_description: string
          p_slug: string
          p_sort_order: number
        }
        Returns: Json
      }
      upsert_commerce_pincode: {
        Args: {
          p_eta_max_days: number
          p_eta_min_days: number
          p_idempotency_key: string
          p_pincode: string
          p_serviceable: boolean
          p_zone_code: string
        }
        Returns: Json
      }
      upsert_commerce_product_variant: {
        Args: {
          p_availability_mode: string
          p_compare_at_price_paise: number
          p_display_name: string
          p_id: string
          p_idempotency_key: string
          p_option_values: Json
          p_product_id: string
          p_selling_price_paise: number
          p_sku: string
          p_sort_order: number
        }
        Returns: Json
      }
      upsert_commerce_tax_rate: {
        Args: {
          p_code: string
          p_description: string
          p_id: string
          p_idempotency_key: string
          p_is_active: boolean
          p_name: string
          p_rate_basis_points: number
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
      verify_campaign_execution_context_binding: {
        Args: {
          p_campaign_reference: string
          p_campaign_version_number: number
          p_landing_publication_reference: string
          p_provider_channel: string
          p_run_reference: string
          p_run_target_reference: string
        }
        Returns: Json
      }
      verify_live_landing_publication_context: {
        Args: {
          p_experiment_reference: string | null
          p_page_reference: string
          p_page_version_number: number
          p_publication_reference: string
          p_variant_key: string | null
        }
        Returns: Json
      }
      verify_public_commerce_order_tracking_identity: {
        Args: { p_mobile_e164: string; p_order_reference: string }
        Returns: Json
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

