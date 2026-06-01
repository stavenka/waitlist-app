require('dotenv').config();
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const c = new BetaAnalyticsDataClient();
const p = process.env.GA_PROPERTY_ID;

function fmt(sec) { sec = Math.round(sec); const m = Math.floor(sec/60), s = sec%60; return m>0?`${m}m ${s}s`:`${s}s`; }

(async () => {
  // 1. Breakdown by city for Apr 14-16
  const [byCity] = await c.runReport({
    property: `properties/${p}`,
    dateRanges: [{ startDate: '2026-04-14', endDate: '2026-04-16' }],
    metrics: [
      { name: 'sessions' }, { name: 'activeUsers' },
      { name: 'screenPageViews' }, { name: 'userEngagementDuration' },
    ],
    dimensions: [{ name: 'city' }, { name: 'country' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15,
  });
  console.log('=== Sessions by city (Apr 14-16) ===');
  console.log('City              Country           Sessions  Users  Views  Engage/User');
  console.log('-'.repeat(80));
  byCity.rows.forEach(r => {
    const city = (r.dimensionValues[0].value || '(not set)').padEnd(17);
    const country = (r.dimensionValues[1].value || '').padEnd(17);
    const s = r.metricValues[0].value.padStart(8);
    const u = r.metricValues[1].value.padStart(5);
    const v = r.metricValues[2].value.padStart(5);
    const eng = parseFloat(r.metricValues[3].value);
    const users = parseInt(r.metricValues[1].value,10);
    const engPerUser = users>0 ? fmt(eng/users) : '-';
    console.log(`${city} ${country} ${s}  ${u}  ${v}   ${engPerUser}`);
  });

  // 2. Totals EXCLUDING London
  const [excl] = await c.runReport({
    property: `properties/${p}`,
    dateRanges: [{ startDate: '2026-04-14', endDate: '2026-04-16' }],
    metrics: [
      { name: 'sessions' }, { name: 'activeUsers' },
      { name: 'screenPageViews' }, { name: 'averageSessionDuration' },
      { name: 'userEngagementDuration' }, { name: 'screenPageViewsPerSession' },
    ],
    dimensionFilter: {
      notExpression: {
        filter: { fieldName: 'city', stringFilter: { matchType: 'EXACT', value: 'London' } }
      }
    },
  });
  const e = excl.rows?.[0]?.metricValues || [];
  console.log('\n=== Apr 14-16, London EXCLUDED ===');
  if (e.length) {
    const sessions = parseInt(e[0].value,10);
    const users = parseInt(e[1].value,10);
    const views = parseInt(e[2].value,10);
    const avgSess = parseFloat(e[3].value);
    const engDur = parseFloat(e[4].value);
    const pvPerSess = parseFloat(e[5].value);
    console.log(`  Sessions:            ${sessions}`);
    console.log(`  Users:               ${users}`);
    console.log(`  Pageviews:           ${views}`);
    console.log(`  Avg session:         ${fmt(avgSess)}`);
    console.log(`  Avg engage/user:     ${users>0 ? fmt(engDur/users) : '-'}`);
    console.log(`  Pages per session:   ${pvPerSess.toFixed(2)}`);
  } else console.log('  (no non-London sessions)');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
