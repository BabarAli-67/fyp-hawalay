/**
 * One-time cleanup: remove broken secondaryLocation docs that break 2dsphere queries.
 * Run from repo root: node server/scripts/fix-invalid-secondary-locations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const result = await mongoose.connection.collection('items').updateMany(
    {
      $or: [
        { 'secondaryLocation.coordinates': { $exists: false } },
        { 'secondaryLocation.coordinates': { $size: 0 } },
        { 'secondaryLocation.coordinates': null },
      ],
    },
    { $unset: { secondaryLocation: '' } },
  );
  console.log(`Unset invalid secondaryLocation on ${result.modifiedCount} item(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
