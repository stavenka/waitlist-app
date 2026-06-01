// One-off smoke test for the GA4 Data API chain.
// Reads .env, authenticates with ga-key.json, and pulls last 7 days of traffic.
require('dotenv').config();
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const propertyId = process.env.GA_PROPERTY_ID;
const client = new BetaAnalyticsDataClient();

(async () => {
  try {
    console.log(`Querying property ${propertyId} for last 7 days...\n`);
    const [report] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'activeUsers' },
      ],
      dimensions: [{ name: 'date' }],
    });

    console.log('Date       Views  Sessions  Users');
    console.log('-'.repeat(40));
    let totalViews = 0, totalSessions = 0, totalUsers = 0;
    (report.rows || []).forEach((r) => {
      const d = r.dimensionValues[0].value;
      const v = parseInt(r.metricValues[0].value, 10);
      const s = parseInt(r.metricValues[1].value, 10);
      const u = parseInt(r.metricValues[2].value, 10);
      totalViews += v; totalSessions += s; totalUsers += u;
      console.log(
        `${d}   ${String(v).padStart(5)}   ${String(s).padStart(7)}   ${String(u).padStart(4)}`
      );
    });
    console.log('-'.repeat(40));
    console.log(
      `TOTAL      ${String(totalViews).padStart(5)}   ${String(totalSessions).padStart(7)}   ${String(totalUsers).padStart(4)}`
    );
    console.log('\nGA4 chain is working end-to-end.');
  } catch (err) {
    console.error('\nERROR from GA API:');
    console.error(err.message || err);
    if (err.details) console.error('Details:', err.details);
    process.exit(1);
  }
})();
