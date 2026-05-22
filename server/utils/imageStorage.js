const { Readable } = require('stream');
const mongoose = require('mongoose');
const { getGridFSBucket } = require('../config/gridfs');

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} contentType
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
function uploadToGridFS(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const id = new mongoose.Types.ObjectId();
    const readable = Readable.from(buffer);
    const uploadStream = bucket.openUploadStreamWithId(id, filename, { contentType });

    readable.on('error', reject);
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(id));

    readable.pipe(uploadStream);
  });
}

/**
 * @param {mongoose.Types.ObjectId | string} fileId
 * @returns {import('stream').Readable}
 */
function getImageStream(fileId) {
  const bucket = getGridFSBucket();
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(String(fileId)));
}

/**
 * @param {mongoose.Types.ObjectId | string} fileId
 * @returns {Promise<void>}
 */
function deleteFromGridFS(fileId) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    bucket.delete(new mongoose.Types.ObjectId(String(fileId)), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  uploadToGridFS,
  getImageStream,
  deleteFromGridFS,
};
