export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  school_or_org: string | null;
  district: string | null;
  bio: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}
