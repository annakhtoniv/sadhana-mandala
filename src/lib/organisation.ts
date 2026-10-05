import { supabase } from './supabase';
import type { Organisation } from '../types/database';

/**
 * Resolves the organisation slug.
 * In v1, resolves from VITE_ORG_SLUG.
 * Structured to cleanly support subdomain resolution in the future.
 */
export function getResolvedOrgSlug(): string {
  // Reserved for future multi-tenant custom domains/subdomains:
  // const hostname = window.location.hostname;
  // const parts = hostname.split('.');
  // if (parts.length > 2 && parts[0] !== 'www') return parts[0];

  return import.meta.env.VITE_ORG_SLUG || 'sadhana-mandala';
}

export const DEFAULT_ORGANISATION: Organisation = {
  id: '',
  name: 'Sadhana Mandala',
  slug: 'sadhana-mandala',
  app_name: 'Sadhana Mandala',
  logo_url: null,
  primary_colour: '#1c1917',
  accent_colour: '#059669',
  support_email: 'support@zyxenai.com',
  checkin_question: 'Did you complete your daily practice today?',
  footer_text: 'Mindful daily practice and teacher guidance',
  timezone: 'Asia/Dubai',
  show_powered_by: true,
  created_at: new Date().toISOString(),
};

export async function fetchOrganisation(slug: string): Promise<Organisation> {
  try {
    const { data, error } = await supabase
      .from('organisations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch organisation from database, using fallback default:', error.message);
      return DEFAULT_ORGANISATION;
    }

    if (!data) {
      console.warn(`No organisation found with slug "${slug}". Using default.`);
      return DEFAULT_ORGANISATION;
    }

    return data as Organisation;
  } catch (err) {
    console.error('Unexpected error fetching organisation:', err);
    return DEFAULT_ORGANISATION;
  }
}
