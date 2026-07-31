export type SystemRole = "administrator" | "operator";

export interface SystemUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: SystemRole;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemAccessLog {
  id: number;
  user_id: string;
  email: string;
  event_type: "login" | "logout" | "password_changed";
  user_agent: string | null;
  created_at: string;
}
