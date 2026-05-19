const mongoose = require('mongoose');

const BUCKET_NAME = 'item_images';

let bucket;

mongoose.connection.on('open', () => {
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: BUCKET_NAME,
  });
  console.info(`[gridfs] bucket initialized: ${BUCKET_NAME}`);
});

function getGridFSBucket() {
  if (!bucket) {
    throw new Error('GridFS bucket is not initialized yet');
  }
  return bucket;
}

module.exports = {
  BUCKET_NAME,
  getGridFSBucket,
};
