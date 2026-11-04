export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; role: string; created_at: string; updated_at: string }
        Insert: { id: string; full_name?: string | null; role?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; full_name?: string | null; role?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      categories: {
        Row: { id: string; name: string; description: string | null; icon: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; name: string; description?: string | null; icon?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; description?: string | null; icon?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      subjects: {
        Row: { id: string; name: string; academic_level: string; is_active: boolean; created_at: string }
        Insert: { id?: string; name: string; academic_level: string; is_active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; academic_level?: string; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      resources: {
        Row: {
          id: string; title: string; description: string | null; keywords: string[]; category_id: string; subject_id: string | null
          academic_level: string; class_level: string | null; academic_year: number | null; author: string | null
          publisher: string | null; cover_image_path: string | null; file_path: string; file_format: string; file_size: number
          status: string; download_count: number; uploaded_by: string; modified_by: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; title: string; description?: string | null; keywords?: string[]; category_id: string; subject_id?: string | null
          academic_level: string; class_level?: string | null; academic_year?: number | null; author?: string | null
          publisher?: string | null; cover_image_path?: string | null; file_path: string; file_format: string; file_size: number
          status?: string; download_count?: number; uploaded_by: string; modified_by?: string | null; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; title?: string; description?: string | null; keywords?: string[]; category_id?: string; subject_id?: string | null
          academic_level?: string; class_level?: string | null; academic_year?: number | null; author?: string | null
          publisher?: string | null; cover_image_path?: string | null; file_path?: string; file_format?: string; file_size?: number
          status?: string; download_count?: number; uploaded_by?: string; modified_by?: string | null; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'resources_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'resources_subject_id_fkey'; columns: ['subject_id']; isOneToOne: false; referencedRelation: 'subjects'; referencedColumns: ['id'] },
        ]
      }
      downloads: {
        Row: { id: string; resource_id: string; downloaded_at: string }
        Insert: { id?: string; resource_id: string; downloaded_at?: string }
        Update: { id?: string; resource_id?: string; downloaded_at?: string }
        Relationships: [{ foreignKeyName: 'downloads_resource_id_fkey'; columns: ['resource_id']; isOneToOne: false; referencedRelation: 'resources'; referencedColumns: ['id'] }]
      }
      reports: {
        Row: { id: string; resource_id: string; reason: string; description: string | null; status: string; created_at: string }
        Insert: { id?: string; resource_id: string; reason: string; description?: string | null; status?: string; created_at?: string }
        Update: { id?: string; resource_id?: string; reason?: string; description?: string | null; status?: string; created_at?: string }
        Relationships: [{ foreignKeyName: 'reports_resource_id_fkey'; columns: ['resource_id']; isOneToOne: false; referencedRelation: 'resources'; referencedColumns: ['id'] }]
      }
      contact_messages: {
        Row: { id: string; full_name: string; email: string; subject: string; message: string; status: string; created_at: string }
        Insert: { id?: string; full_name: string; email: string; subject: string; message: string; status?: string; created_at?: string }
        Update: { id?: string; full_name?: string; email?: string; subject?: string; message?: string; status?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      record_download: { Args: { resource_uuid: string }; Returns: undefined }
      search_resource_ids: { Args: { search_query: string }; Returns: { resource_id: string }[] }
      admin_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: { total_resources: number; published_resources: number; draft_resources: number; total_downloads: number }[]
      }
      submit_resource_report: { Args: { resource_uuid: string; report_reason: string; report_description?: string | null }; Returns: string }
      submit_contact_message: { Args: { sender_name: string; sender_email: string; message_subject: string; message_body: string }; Returns: string }
      set_contact_message_status: { Args: { message_uuid: string; new_status: string }; Returns: undefined }
      admin_dashboard_stats_v2: {
        Args: Record<PropertyKey, never>
        Returns: { total_resources: number; published_resources: number; draft_resources: number; total_downloads: number; textbook_resources: number; past_papers: number; study_notes: number }[]
      }
      set_admin_profile_name: { Args: { new_full_name: string }; Returns: undefined }
      set_profile_role: { Args: { profile_uuid: string; new_role: string }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
