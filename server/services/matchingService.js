/**
 * Runs matching for a newly created item (async, non-blocking).
 * Extend when FastAPI / vector search pipeline is ready.
 */
async function triggerMatching(item) {
  console.info('[matching] queued for item', item._id.toString());
}

module.exports = {
  triggerMatching,
};
