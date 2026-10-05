export type UserRole = 'student' | 'teacher' | 'admin';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  app_name: string;
  logo_url: string | null;
  primary_colour: string;
  accent_colour: string;
  support_email: string | null;
  checkin_question: string;
  footer_text: string | null;
  timezone: string;
  show_powered_by: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleGrant {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  created_at: string;
}
