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
        Row: { id: string; name: string; description: string | null; icon: string | null; created_at: string }
        Insert: { id?: string; name: string; description?: string | null; icon?: string | null; created_at?: string }
        Update: { id?: string; name?: string; description?: string | null; icon?: string | null; created_at?: string }
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
    }
    Views: Record<string, never>
    Functions: {
      record_download: { Args: { resource_uuid: string }; Returns: undefined }
      search_resource_ids: { Args: { search_query: string }; Returns: { resource_id: string }[] }
      admin_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: { total_resources: number; published_resources: number; draft_resources: number; total_downloads: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
