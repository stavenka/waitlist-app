require('dotenv').config();
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const client = new BetaAnalyticsDataClient();
const propertyId = process.env.GA_PROPERTY_ID;

function fmt(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

(async () => {
  const [report] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '2026-04-14', endDate: '2026-04-16' }],
    metrics: [
      { name: 'averageSessionDuration' },
      { name: 'userEngagementDuration' },
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'engagementRate' },
      { name: 'screenPageViewsPerSession' },
    ],
    dimensions: [{ name: 'date' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  });

  console.log('Date        AvgSession   AvgEngage/User   PV/Session   EngageRate');
  console.log('-'.repeat(75));
  let totalSessDur = 0, totalSessions = 0, totalEngage = 0, totalUsers = 0, totalPV = 0;
  (report.rows || []).forEach((r) => {
    const d = r.dimensionValues[0].value;
    const avgSess = parseFloat(r.metricValues[0].value);
    const engageDur = parseFloat(r.metricValues[1].value);
    const users = parseInt(r.metricValues[2].value, 10);
    const sess = parseInt(r.metricValues[3].value, 10);
    const engageRate = parseFloat(r.metricValues[4].value);
    const pvPerSess = parseFloat(r.metricValues[5].value);
    const avgEngPerUser = users > 0 ? engageDur / users : 0;
    totalSessDur += avgSess * sess;
    totalSessions += sess;
    totalEngage += engageDur;
    totalUsers += users;
    totalPV += pvPerSess * sess;
    console.log(
      `${d}   ${fmt(avgSess).padStart(8)}     ${fmt(avgEngPerUser).padStart(8)}     ${pvPerSess.toFixed(2).padStart(6)}     ${(engageRate*100).toFixed(1).padStart(5)}%`
    );
  });
  console.log('-'.repeat(75));
  const overallAvgSess = totalSessions ? totalSessDur / totalSessions : 0;
  const overallAvgEng  = totalUsers ? totalEngage / totalUsers : 0;
  const overallPV      = totalSessions ? totalPV / totalSessions : 0;
  console.log(
    `3-DAY AVG    ${fmt(overallAvgSess).padStart(8)}     ${fmt(overallAvgEng).padStart(8)}     ${overallPV.toFixed(2).padStart(6)}`
  );
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
