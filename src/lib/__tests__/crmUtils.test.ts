import { describe, it, expect } from 'vitest';
import {
  eventInviteMessage,
  filterContacts,
  isFollowUpDue,
  phoneDigits,
  pipelineCounts,
  programmeInviteMessage,
  stageRank,
  validateContactInput,
  whatsappUrl,
  mailtoUrl,
  type ContactInput,
} from '../crmUtils';
import type { CrmStage } from '../../types/database';

const lead = (full_name: string, stage: CrmStage, next_action_on: string | null = null, email: string | null = null) => ({
  full_name, stage, next_action_on, email, phone: null as string | null,
});

describe('pipeline', () => {
  it('orders the stages and puts lost outside the pipeline', () => {
    expect(stageRank('new')).toBe(0);
    expect(stageRank('registered')).toBeGreaterThan(stageRank('attended'));
    expect(stageRank('lost')).toBe(-1);
  });

  it('counts leads per stage', () => {
    const counts = pipelineCounts([lead('A', 'new'), lead('B', 'new'), lead('C', 'lost')]);
    expect(counts.new).toBe(2);
    expect(counts.lost).toBe(1);
    expect(counts.invited).toBe(0);
  });
});

describe('follow-ups due', () => {
  it('is due on or after the date, never for lost or completed leads', () => {
    expect(isFollowUpDue(lead('A', 'new', '2026-10-12'), '2026-10-12')).toBe(true);
    expect(isFollowUpDue(lead('A', 'new', '2026-10-13'), '2026-10-12')).toBe(false);
    expect(isFollowUpDue(lead('A', 'lost', '2026-10-01'), '2026-10-12')).toBe(false);
    expect(isFollowUpDue(lead('A', 'new', null), '2026-10-12')).toBe(false);
  });

  it('filters by stage, due and search, due leads first', () => {
    const list = [lead('Zara', 'new', '2026-10-10'), lead('Adam', 'new'), lead('Hiro', 'attended', null, 'hiro@example.com')];
    expect(filterContacts(list, 'all', '', '2026-10-12').map((c) => c.full_name)).toEqual(['Zara', 'Adam', 'Hiro']);
    expect(filterContacts(list, 'due', '', '2026-10-12').map((c) => c.full_name)).toEqual(['Zara']);
    expect(filterContacts(list, 'attended', '', '2026-10-12').map((c) => c.full_name)).toEqual(['Hiro']);
    expect(filterContacts(list, 'all', 'HIRO@', '2026-10-12').map((c) => c.full_name)).toEqual(['Hiro']);
  });
});

describe('validateContactInput', () => {
  const input = (over: Partial<ContactInput> = {}): ContactInput => ({
    full_name: 'Rania Aziz', email: '', phone: '+971 50 000 0001', source: 'friend', interest_course_id: null,
    owner_id: null, consent: true, opted_out: false, next_action_on: '', notes: '', ...over,
  });

  it('needs a name and a way to reach the person', () => {
    expect(validateContactInput(input())).toEqual([]);
    expect(validateContactInput(input({ full_name: ' ' }))).toHaveLength(1);
    expect(validateContactInput(input({ phone: '' }))).toHaveLength(1);
    expect(validateContactInput(input({ email: 'not-an-email' }))).toHaveLength(1);
    expect(validateContactInput(input({ phone: '123' }))).toHaveLength(1);
  });
});

describe('one-tap invite links', () => {
  it('builds WhatsApp links with the international number only', () => {
    expect(phoneDigits('+971 50 000 0001')).toBe('971500000001');
    expect(phoneDigits('00971 50 000 0001')).toBe('971500000001');
    expect(phoneDigits('+٩٧١ ٥٠ ٠٠٠ ٠٠٠١')).toBe('971500000001');
    expect(whatsappUrl('+971 50 000 0001', 'Hi there')).toBe('https://wa.me/971500000001?text=Hi%20there');
    expect(whatsappUrl('050 000 0001', 'Hi')).toBe('https://wa.me/?text=Hi');
    expect(whatsappUrl(null, 'Hi')).toBe('https://wa.me/?text=Hi');
  });

  it('builds an email link', () => {
    expect(mailtoUrl('a@example.com', 'Intro talk', 'Hi & welcome')).toBe('mailto:a%40example.com?subject=Intro%20talk&body=Hi%20%26%20welcome');
  });

  it('writes the invitation texts with first names', () => {
    const talk = eventInviteMessage({
      contactName: 'Rania Aziz', senderName: 'Ravi Kumar', eventTitle: 'Introduction to the Happiness Program',
      when: 'Thu 15 Oct, 19:00', venue: 'Community centre', onlineUrl: null,
    });
    expect(talk).toContain('Hi Rania,');
    expect(talk).toContain('"Introduction to the Happiness Program" on Thu 15 Oct, 19:00 at Community centre');
    expect(talk.endsWith('Ravi')).toBe(true);

    const prog = programmeInviteMessage({
      contactName: 'Hiro Tanaka', senderName: '', courseName: 'Happiness Program', batchName: 'New Moon',
      startDate: '11 Oct 2026', joinUrl: 'https://sadhana.zyxenai.com/?code=MOON02', appName: 'Sadhana Mandala',
    });
    expect(prog).toContain('https://sadhana.zyxenai.com/?code=MOON02');
    expect(prog.endsWith('?code=MOON02')).toBe(true);
  });
});
