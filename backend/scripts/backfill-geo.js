// One-off backfill: resolve countries for IPs already recorded in open/click logs.
// Run once after enabling geo capture:  node scripts/backfill-geo.js
const prisma = require('../src/config/database.config');
const { ensureGeo, normalizeIp } = require('../src/modules/tracking/geo.service');

(async () => {
  const [opens, clicks] = await Promise.all([
    prisma.openLog.findMany({ select: { ip: true } }),
    prisma.clickLog.findMany({ select: { ip: true } }),
  ]);
  const ips = [...new Set([...opens, ...clicks].map((r) => normalizeIp(r.ip)).filter(Boolean))];
  console.log(`Resolving ${ips.length} distinct IP(s)…`);
  let done = 0;
  for (const ip of ips) {
    await ensureGeo(ip);  
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${ips.length}`);
  }
  console.log(`Done. Cached geolocation for up to ${ips.length} IP(s).`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
