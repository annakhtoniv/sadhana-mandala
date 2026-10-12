import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchFunnelReport } from '../lib/crmService';
import { SOURCE_LABEL } from '../lib/crmUtils';
import { getTodayInTimezone } from '../lib/dateUtils';
import type { FunnelReport } from '../types/database';
import { BarChart3, RefreshCw } from 'lucide-react';

type Period = 'all' | '90' | '30';

function sinceDate(period: Period, today: string): string | null {
  if (period === 'all') return null;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - Number(period));
  return d.toISOString().slice(0, 10);
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–';
}

const FunnelBars: React.FC<{ steps: { label: string; value: number }[]; tone: string }> = ({ steps, tone }) => {
  const top = Math.max(1, steps[0]?.value || 0);
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={step.label} className="space-y-0.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-stone-700 dark:text-stone-300">{step.label}</span>
            <span className="font-semibold text-stone-900 dark:text-stone-100">
              {step.value}
              {i > 0 && (
                <span className="ml-1.5 text-[10px] font-normal text-stone-500">{pct(step.value, steps[i - 1].value)} of previous</span>
              )}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round((step.value / top) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Phase 10 funnel report: leads to Happiness Program to Sadhana to next programme. */
export const FunnelReportPanel: React.FC = () => {
  const { organisation } = useAuth();
  const [period, setPeriod] = useState<Period>('all');
  const [report, setReport] = useState<FunnelReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchFunnelReport(sinceDate(period, getTodayInTimezone(organisation.timezone))));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const card = 'bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Funnel report</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
          >
            <option value="all">All time</option>
            <option value="90">Last 90 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <button type="button" onClick={load} aria-label="Refresh report" className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 text-xs text-red-600 dark:text-red-400">{error}</div>}

      {report && (
        <>
          <div className={card}>
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Leads (CRM)</h3>
              <p className="text-[11px] text-stone-500">Each lead counts at the furthest stage it reached, even if it was later marked lost.</p>
            </div>
            <FunnelBars
              tone="bg-indigo-500"
              steps={[
                { label: 'Leads', value: report.leads.total },
                { label: 'Invited to an intro talk', value: report.leads.invited },
                { label: 'Attended an intro talk', value: report.leads.attended },
                { label: 'Interested', value: report.leads.interested },
                { label: 'Registered for a programme', value: report.leads.registered },
                { label: 'Completed', value: report.leads.completed },
              ]}
            />
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2 rounded-xl border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase font-semibold text-stone-500">Signed up in the app</div>
                <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{report.leads.signed_up}</div>
              </div>
              <div className="p-2 rounded-xl border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase font-semibold text-stone-500">Lost</div>
                <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{report.leads.lost}</div>
              </div>
            </div>
          </div>

          {report.journey.map((j) => (
            <div key={j.course_id} className={card}>
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{j.course_name}: student journey</h3>
                <p className="text-[11px] text-stone-500">
                  All students, from the app. "Completed" means the {j.practice_days}-day practice is over and they checked in "done" on at
                  least 80% of the days.
                </p>
              </div>
              <FunnelBars
                tone="bg-emerald-500"
                steps={[
                  { label: 'Enrolled', value: j.enrolled },
                  { label: 'Practice period over', value: j.track_over },
                  { label: 'Completed the practice', value: j.completed },
                ]}
              />
              <div className="flex items-baseline justify-between text-xs pt-1 border-t border-stone-100 dark:border-stone-800">
                <span className="text-stone-700 dark:text-stone-300">Went on to a next programme</span>
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {j.next_programme} <span className="text-[10px] font-normal text-stone-500">({pct(j.next_programme, j.enrolled)} of enrolled)</span>
                </span>
              </div>
            </div>
          ))}
          {report.journey.length === 0 && (
            <div className={card}>
              <p className="text-xs text-stone-500">No programme with a daily practice track has students yet.</p>
            </div>
          )}

          <div className={card}>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Where leads come from</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-stone-500">
                  <th className="py-1 font-semibold">Source</th>
                  <th className="py-1 font-semibold text-right">Leads</th>
                  <th className="py-1 font-semibold text-right">Registered</th>
                </tr>
              </thead>
              <tbody>
                {report.sources.map((s) => (
                  <tr key={s.source} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="py-1.5 text-stone-700 dark:text-stone-300">{SOURCE_LABEL[s.source] || s.source}</td>
                    <td className="py-1.5 text-right">{s.leads}</td>
                    <td className="py-1.5 text-right">{s.registered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Leads per volunteer</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-stone-500">
                  <th className="py-1 font-semibold">Owner</th>
                  <th className="py-1 font-semibold text-right">Leads</th>
                  <th className="py-1 font-semibold text-right">Registered</th>
                </tr>
              </thead>
              <tbody>
                {report.owners.map((o) => (
                  <tr key={o.owner_id || 'none'} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="py-1.5 text-stone-700 dark:text-stone-300">{o.name}</td>
                    <td className="py-1.5 text-right">{o.leads}</td>
                    <td className="py-1.5 text-right">{o.registered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
