import { fetchAllPages } from './paging';
import { supabase } from './supabase';
import type { CrmActivity, CrmActivityKind, CrmContact, CrmOwner, CrmStage, FunnelReport } from '../types/database';
import { STAGE_LABEL, type ContactInput } from './crmUtils';


type Result = { success: boolean; error?: string };
export type RpcResult = { success: boolean; message?: string; title?: string; join_code?: string; batch_name?: string; course_name?: string; enrolled?: boolean };

/** Leads the user may see: all of the organisation for admins and teachers, own leads for volunteers. */
export async function fetchContacts(orgId: string): Promise<CrmContact[]> {
  return fetchAllPages<CrmContact>((from, to) =>
    supabase.from('crm_contacts').select('*').eq('org_id', orgId)
      .order('updated_at', { ascending: false }).order('id', { ascending: true }).range(from, to)
  );
}

export async function fetchActivities(contactId: string): Promise<CrmActivity[]> {
  const { data, error } = await supabase
    .from('crm_activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CrmActivity[]) || [];
}

/** Volunteers, teachers and admins who can own leads. */
export async function fetchOwners(): Promise<CrmOwner[]> {
  const { data, error } = await supabase.rpc('crm_owners');
  if (error) throw new Error(error.message);
  return (data as CrmOwner[]) || [];
}

export async function saveContact(
  orgId: string,
  userId: string,
  input: ContactInput,
  existing: CrmContact | null
): Promise<Result & { contact?: CrmContact }> {
  const row = {
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase() || null,
    phone: input.phone.trim() || null,
    source: input.source,
    interest_course_id: input.interest_course_id,
    owner_id: input.owner_id || userId,
    consent_at: input.consent ? existing?.consent_at || new Date().toISOString() : null,
    opted_out: input.opted_out,
    next_action_on: input.next_action_on || null,
    notes: input.notes.trim() || null,
  };
  const query = existing
    ? supabase.from('crm_contacts').update(row).eq('id', existing.id).select().single()
    : supabase.from('crm_contacts').insert({ ...row, org_id: orgId, created_by: userId }).select().single();
  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, contact: data as CrmContact };
}

export async function deleteContact(contactId: string): Promise<Result> {
  const { error } = await supabase.from('crm_contacts').delete().eq('id', contactId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function addActivity(
  orgId: string,
  userId: string,
  contactId: string,
  kind: Exclude<CrmActivityKind, 'stage'>,
  body: string
): Promise<Result> {
  const { error } = await supabase
    .from('crm_activities')
    .insert({ org_id: orgId, contact_id: contactId, kind, body: body.trim(), created_by: userId });
  return error ? { success: false, error: error.message } : { success: true };
}

/** Moves a lead to another stage and notes the change. */
export async function setContactStage(orgId: string, userId: string, contact: CrmContact, stage: CrmStage): Promise<Result> {
  const { error } = await supabase.from('crm_contacts').update({ stage }).eq('id', contact.id);
  if (error) return { success: false, error: error.message };
  await addActivity(orgId, userId, contact.id, 'note', `Moved from ${STAGE_LABEL[contact.stage]} to ${STAGE_LABEL[stage]}`);
  return { success: true };
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { success: false, message: error.message };
  return (data as RpcResult) || { success: false, message: 'No answer from the server.' };
}

/** Registers the lead for an event (as a guest, or as the member once they have an account). */
export async function inviteContactToEvent(contactId: string, eventId: string): Promise<RpcResult> {
  return callRpc('crm_invite_to_event', { p_contact_id: contactId, p_event_id: eventId });
}

/** Enrols the lead (or invites their email, so they are enrolled when they sign in). */
export async function registerContactForBatch(contactId: string, batchId: string): Promise<RpcResult> {
  return callRpc('crm_register_for_batch', { p_contact_id: contactId, p_batch_id: batchId });
}

/** Phase 10: funnel report for admins and teachers. */
export async function fetchFunnelReport(since: string | null): Promise<FunnelReport> {
  const { data, error } = await supabase.rpc('crm_funnel_report', { p_since: since });
  if (error) throw new Error(error.message);
  const res = data as (FunnelReport & { success: boolean; message?: string }) | null;
  if (!res || res.success === false) throw new Error(res?.message || 'Could not load the report.');
  return res;
}

export interface OpenBatch {
  id: string;
  name: string;
  course_id: string;
  course_name: string;
  start_date: string;
  join_code: string;
}

/** Batches a lead can be registered for (started in the last 14 days or later). */
export async function fetchOpenBatches(): Promise<OpenBatch[]> {
  const { data, error } = await supabase.rpc('crm_open_batches');
  if (error) throw new Error(error.message);
  return (data as OpenBatch[]) || [];
}
