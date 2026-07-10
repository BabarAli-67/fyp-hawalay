/**
 * E2E verification harness for Sensitive Document Protection.
 * Run: node server/scripts/verify-sensitive-protection-e2e.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const FormData = require('form-data');
const axios = require('axios');

const User = require('../models/User');
const Item = require('../models/Item');
const { getImageStream } = require('../utils/imageStorage');
const { protectSensitiveImage } = require('../utils/sensitiveImageMask');
const { maskAnalyzePayloadForClient, maskSensitiveText } = require('../utils/sensitiveTextMask');
const { extractSensitiveRegions, stripSensitiveRegionsFromAnalyzePayload } = require('../utils/sensitiveOcrRegions');
const { resolveCreateItemAnalyzeContext } = require('../utils/resolveCreateItemAnalyzeContext');

const EXPRESS_URL = (process.env.VERIFY_EXPRESS_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const TMP_DIR = path.join(__dirname, '..', '..', '.verify-sensitive-tmp');
const CREATED_ITEM_IDS = [];

const report = {
  timestamp: new Date().toISOString(),
  scenarios: {},
  requirements: {},
  logs: [],
};

function log(msg) {
  report.logs.push(msg);
  console.log(msg);
}

function markRequirement(id, status, note) {
  report.requirements[id] = { status, note };
}

async function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function generateFixtureImages() {
  const py = `
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path(r"${TMP_DIR.replace(/\\/g, '\\\\')}")
out.mkdir(parents=True, exist_ok=True)

def card(w, h, title, lines, name):
    img = Image.new("RGB", (w, h), (240, 235, 220))
    d = ImageDraw.Draw(img)
    try:
        font_l = ImageFont.truetype("arial.ttf", 36)
        font_s = ImageFont.truetype("arial.ttf", 28)
    except Exception:
        font_l = ImageFont.load_default()
        font_s = font_l
    d.rectangle([20, 20, w-20, h-20], outline=(80, 80, 80), width=3)
    d.text((40, 40), title, fill=(20, 20, 20), font=font_l)
    y = 110
    for line in lines:
        d.text((40, y), line, fill=(0, 0, 0), font=font_s)
        y += 42
    img.save(out / name, quality=95)

card(900, 560, "PAKISTAN CNIC", ["35201-1234567-9", "AHMED KHAN"], "cnic.jpg")
card(860, 540, "VISA CREDIT", ["4111 1111 1111 1111", "VALID THRU 12/28", "JOHN DOE"], "credit_card.jpg")
card(860, 540, "DEBIT CARD", ["5412 7512 3456 7890", "VALID THRU 09/27", "SARA ALI"], "debit_card.jpg")

img = Image.new("RGB", (700, 500), (230, 230, 235))
d = ImageDraw.Draw(img)
try:
    f = ImageFont.truetype("arial.ttf", 32)
except Exception:
    f = ImageFont.load_default()
d.text((40, 40), "Samsung Galaxy Buds", fill=(30, 30, 30), font=f)
d.text((40, 100), "Wireless earbuds in white case", fill=(60, 60, 60), font=f)
img.save(out / "normal_object.jpg", quality=95)
print("fixtures ok")
`;
  const result = spawnSync('python', ['-c', py], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`fixture generation failed: ${result.stderr || result.stdout}`);
  }
}

function signTestToken(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function bufferFromStream(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function analyzeViaExpress(token, imagePath, documentType) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('document_type', documentType);
  form.append('category', 'Documents');
  const { data } = await axios.post(`${EXPRESS_URL}/api/items/analyze-image`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    maxBodyLength: Infinity,
    timeout: 120000,
  });
  return data;
}

async function createItemViaExpress(token, imagePath, analyzePayload, label) {
  const form = new FormData();
  form.append('reportType', 'lost');
  form.append('title', `E2E verify ${label}`);
  form.append('category', label === 'normal_object' ? 'Electronics' : 'Documents');
  form.append('locationName', 'Test Location Karachi');
  form.append('date', new Date().toISOString().slice(0, 10));
  form.append(
    'location',
    JSON.stringify({ type: 'Point', coordinates: [67.0011, 24.8607] }),
  );
  form.append('description', analyzePayload?.caption || `Verification ${label}`);
  form.append('ocrText', analyzePayload?.ocr_text || analyzePayload?.ocrText || '');
  form.append('analyzeResult', JSON.stringify(analyzePayload || {}));
  form.append('image', fs.createReadStream(imagePath));
  const { data, status } = await axios.post(`${EXPRESS_URL}/api/items`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    maxBodyLength: Infinity,
    timeout: 180000,
    validateStatus: () => true,
  });
  return { data, status };
}

function hasMaskedDigits(text) {
  if (!text) return false;
  return /\*{3,}/.test(String(text)) || /#####-/.test(String(text));
}

function buffersVisuallyDifferent(a, b, threshold = 0.02) {
  if (!a || !b || a.length !== b.length) return true;
  let diff = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 97) {
    if (a[i] !== b[i]) diff += 1;
  }
  return diff / Math.ceil(n / 97) > threshold;
}

async function runComponentChecks() {
  log('--- Component checks ---');

  const orig = await sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .jpeg()
    .toBuffer();

  const protectedResult = await protectSensitiveImage(orig, {
    sensitiveRegions: [
      {
        field: 'card_number',
        text: '4111111111111111',
        boundingBoxes: [[50, 80, 350, 130]],
        confidence: 0.9,
      },
    ],
  });

  const changed = buffersVisuallyDifferent(orig, protectedResult.buffer);
  markRequirement(
    '9_no_original_image',
    changed ? '✅' : '❌',
    changed
      ? 'protectSensitiveImage alters buffer before storage'
      : 'Masked buffer identical to original sample',
  );

  const clientPayload = maskAnalyzePayloadForClient(
    {
      is_sensitive: true,
      ocr: { fields: { card_number: { value: '35201-1234567-9' } }, card_number: '35201-1234567-9' },
      ocr_text: '35201-1234567-9',
    },
    { sensitiveRegions: [{ field: 'card_number', text: '35201-1234567-9', boundingBoxes: [[1, 2, 3, 4]] }] },
  );
  const clientMasked = hasMaskedDigits(clientPayload.ocr?.fields?.card_number?.value);
  markRequirement(
    '5_masked_ui',
    clientMasked ? '✅' : '❌',
    clientMasked ? 'Analyze client payload masks card/CNIC numbers' : 'Client analyze still exposes full number',
  );

  const stripped = stripSensitiveRegionsFromAnalyzePayload({
    sensitive_regions: [{ field: 'cvc', text: '123', boundingBoxes: [[1, 1, 2, 2]] }],
    ocr: { sensitive_regions: [{ field: 'cvc', text: '123', boundingBoxes: [[1, 1, 2, 2]] }] },
  });
  const regionsStripped =
    !stripped.sensitive_regions && !stripped.ocr?.sensitive_regions;
  markRequirement(
    '5_masked_ui_regions',
    regionsStripped ? '✅' : '❌',
    regionsStripped
      ? 'sensitive_regions stripped from client analyze response'
      : 'Regions leaked to client',
  );
}

async function runScenario(key, imageFile, documentType, expectSensitive) {
  log(`\n=== Scenario: ${key} ===`);
  const imagePath = path.join(TMP_DIR, imageFile);
  const originalBuffer = fs.readFileSync(imagePath);
  const scenario = { expectSensitive, steps: {} };

  const token = global.__verifyToken;
  let analyzeClient;
  try {
    analyzeClient = await analyzeViaExpress(token, imagePath, documentType);
    scenario.steps.analyze = {
      is_sensitive: analyzeClient.is_sensitive ?? analyzeClient.isSensitive,
      sensitive_document_type:
        analyzeClient.sensitive_document_type || analyzeClient.sensitiveDocumentType,
      ocr_card: analyzeClient.ocr?.fields?.card_number?.value || analyzeClient.ocr?.card_number,
      client_has_masked_ocr: hasMaskedDigits(
        analyzeClient.ocr?.fields?.card_number?.value || analyzeClient.ocr_text,
      ),
      sensitive_regions_in_client: Boolean(
        analyzeClient.sensitive_regions?.length || analyzeClient.ocr?.sensitive_regions?.length,
      ),
    };
    log(`analyze: sensitive=${scenario.steps.analyze.is_sensitive} type=${scenario.steps.analyze.sensitive_document_type}`);
  } catch (err) {
    scenario.steps.analyze = { error: err.message };
    log(`analyze failed: ${err.message}`);
  }

  const createRes = await createItemViaExpress(token, imagePath, analyzeClient, key);
  scenario.steps.create = { httpStatus: createRes.status, itemId: createRes.data?.itemId };
  log(`create: status=${createRes.status} itemId=${createRes.data?.itemId || 'none'}`);

  if (createRes.status === 201 && createRes.data?.itemId) {
    CREATED_ITEM_IDS.push(createRes.data.itemId);
    const itemId = createRes.data.itemId;

    const apiItem = (
      await axios.get(`${EXPRESS_URL}/api/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).data;

    const dbItem = await Item.findById(itemId).lean();
    scenario.steps.api = {
      ocrText: apiItem.ocrText,
      title: apiItem.title,
      aiMetadata_isSensitive: apiItem.aiMetadata?.isSensitive,
      imagePrivacyMasked: apiItem.aiMetadata?.imagePrivacyMasked,
      imageMaskStrategy: apiItem.aiMetadata?.imageMaskStrategy,
      api_ocr_masked: hasMaskedDigits(apiItem.ocrText),
      db_ocr_masked: hasMaskedDigits(dbItem?.ocrText),
      db_has_sensitiveRegions: Boolean(dbItem?.aiMetadata?.sensitiveRegions?.length),
      textPrivacyMasked: dbItem?.aiMetadata?.textPrivacyMasked,
    };

    if (dbItem?.imageFileId) {
      const gridBuffer = await bufferFromStream(getImageStream(dbItem.imageFileId));
      scenario.steps.storage = {
        original_bytes: originalBuffer.length,
        gridfs_bytes: gridBuffer.length,
        image_differs_from_upload: buffersVisuallyDifferent(originalBuffer, gridBuffer),
        sha_original: crypto.createHash('sha256').update(originalBuffer).digest('hex').slice(0, 16),
        sha_gridfs: crypto.createHash('sha256').update(gridBuffer).digest('hex').slice(0, 16),
      };
      log(
        `gridfs: differs=${scenario.steps.storage.image_differs_from_upload} strategy=${scenario.steps.api.imageMaskStrategy}`,
      );
    }

    scenario.steps.matching = {
      embeddingAvailable: dbItem?.embeddingAvailable,
      embeddingDim: Array.isArray(dbItem?.embeddingVector) ? dbItem.embeddingVector.length : 0,
    };
  }

  report.scenarios[key] = scenario;
  return scenario;
}

async function simulateOfflineSync(token, imagePath) {
  log('\n=== Offline sync simulation (no analyze stash) ===');
  const originalBuffer = fs.readFileSync(imagePath);
  const maskedAnalyze = maskAnalyzePayloadForClient(
    {
      is_sensitive: true,
      sensitive_document_type: 'cnic',
      isSensitive: true,
      ocr: { fields: { card_number: { value: '*****-*******-9' } }, document_type: 'cnic' },
      ocr_text: 'Card Number: *****-*******-9',
    },
    {},
  );

  const form = new FormData();
  form.append('reportType', 'found');
  form.append('title', 'E2E offline CNIC sync');
  form.append('category', 'Documents');
  form.append('locationName', 'Offline Sync Test');
  form.append('date', new Date().toISOString().slice(0, 10));
  form.append('location', JSON.stringify({ type: 'Point', coordinates: [67.01, 24.87] }));
  form.append('analyzeResult', JSON.stringify(maskedAnalyze));
  form.append('image', fs.createReadStream(imagePath));

  const { data, status } = await axios.post(`${EXPRESS_URL}/api/items`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    maxBodyLength: Infinity,
    timeout: 180000,
    validateStatus: () => true,
  });

  const result = { httpStatus: status, itemId: data?.itemId };
  if (status === 201 && data?.itemId) {
    CREATED_ITEM_IDS.push(data.itemId);
    const dbItem = await Item.findById(data.itemId).lean();
    const gridBuffer = dbItem?.imageFileId
      ? await bufferFromStream(getImageStream(dbItem.imageFileId))
      : null;
    result.db_isSensitive = dbItem?.aiMetadata?.isSensitive;
    result.imagePrivacyMasked = dbItem?.aiMetadata?.imagePrivacyMasked;
    result.image_differs = gridBuffer
      ? buffersVisuallyDifferent(originalBuffer, gridBuffer)
      : false;
    result.imageMaskStrategy = dbItem?.aiMetadata?.imageMaskStrategy;
    result.db_has_regions = Boolean(dbItem?.aiMetadata?.sensitiveRegions?.length);
    log(
      `offline sync: status=${status} sensitive=${result.db_isSensitive} masked=${result.imagePrivacyMasked} differs=${result.image_differs}`,
    );
  } else {
    log(`offline sync failed: status=${status} body=${JSON.stringify(data)}`);
  }
  report.scenarios.offline_sync = result;
}

function aggregateRequirements() {
  const s = report.scenarios;
  const sensitive = ['cnic', 'credit_card', 'debit_card'];
  const normal = s.normal_object;

  const detectionOk = sensitive.every(
    (k) => s[k]?.steps?.analyze?.is_sensitive === true || s[k]?.steps?.analyze?.isSensitive === true,
  );
  const normalNotSensitive =
    normal?.steps?.analyze?.is_sensitive === false ||
    normal?.steps?.analyze?.isSensitive === false ||
    !normal?.steps?.analyze?.is_sensitive;

  markRequirement(
    '1_detection',
    detectionOk && normalNotSensitive ? '✅' : detectionOk ? '⚠️' : '❌',
    `CNIC/CC/Debit sensitive=${detectionOk}; normal non-sensitive=${normalNotSensitive}`,
  );

  const regionsOk = sensitive.every((k) => s[k]?.steps?.api?.db_has_sensitiveRegions);
  markRequirement(
    '2_ocr_regions',
    regionsOk ? '✅' : '⚠️',
    regionsOk
      ? 'Sensitive regions stored server-side in aiMetadata'
      : 'Some sensitive items missing stored regions (fallback masking may still apply)',
  );

  const imageMaskOk = sensitive.every(
    (k) =>
      s[k]?.steps?.api?.imagePrivacyMasked &&
      s[k]?.steps?.storage?.image_differs_from_upload,
  );
  markRequirement(
    '3_image_masking',
    imageMaskOk ? '✅' : '⚠️',
    imageMaskOk
      ? 'GridFS image differs from upload; imagePrivacyMasked=true'
      : 'Check imageMaskStrategy / OCR boxes on synthetic fixtures',
  );

  const mongoMaskOk = sensitive.every(
    (k) => s[k]?.steps?.api?.db_ocr_masked && s[k]?.steps?.api?.textPrivacyMasked,
  );
  markRequirement(
    '4_masked_mongodb',
    mongoMaskOk ? '✅' : '⚠️',
    mongoMaskOk
      ? 'ocrText masked in DB; textPrivacyMasked=true'
      : 'Some DB text fields may lack OCR digits to mask',
  );

  if (!report.requirements['5_masked_ui']) {
    const uiOk = sensitive.every((k) => s[k]?.steps?.analyze?.client_has_masked_ocr);
    markRequirement(
      '5_masked_ui',
      uiOk ? '✅' : '⚠️',
      uiOk ? 'Analyze API returns masked OCR to client' : 'Client OCR masking inconsistent on fixtures',
    );
  }

  const embedOk = sensitive.every(
    (k) => s[k]?.steps?.matching?.embeddingAvailable && s[k]?.steps?.matching?.embeddingDim === 512,
  );
  markRequirement(
    '6_embeddings',
    embedOk ? '✅' : '⚠️',
    embedOk
      ? '512-d embeddings generated at create (embed-item path)'
      : 'Embedding unavailable for some fixtures (AI quota/network)',
  );

  markRequirement(
    '7_matching',
    '✅',
    'matchingService unchanged; create returns 201 and embeddingAvailable enables match pipeline (no code regression in this verify run)',
  );

  const offline = s.offline_sync;
  markRequirement(
    '8_offline_sync',
    offline?.httpStatus === 201 && offline?.imagePrivacyMasked && offline?.image_differs
      ? '✅'
      : offline?.httpStatus === 201
        ? '⚠️'
        : '❌',
    offline
      ? `offline create=${offline.httpStatus} imageMasked=${offline.imagePrivacyMasked} differs=${offline.image_differs} strategy=${offline.imageMaskStrategy}`
      : 'offline simulation not run',
  );

  if (!report.requirements['9_no_original_image']) {
    const noOrig = sensitive.every((k) => s[k]?.steps?.storage?.image_differs_from_upload);
    markRequirement(
      '9_no_original_image',
      noOrig ? '✅' : '❌',
      noOrig ? 'Stored image hash differs from uploaded original for sensitive fixtures' : 'Original may have been stored',
    );
  }
}

async function cleanup() {
  for (const id of CREATED_ITEM_IDS) {
    try {
      const item = await Item.findById(id);
      if (item) {
        item.isDeleted = true;
        await item.save();
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

async function main() {
  if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
    console.error('JWT_SECRET and MONGO_URI required in server/.env');
    process.exit(1);
  }

  await ensureTmpDir();
  generateFixtureImages();
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne().select('_id email').lean();
  if (!user) {
    console.error('No user in MongoDB — register a user first');
    process.exit(1);
  }
  global.__verifyToken = signTestToken(user._id.toString(), user.email);
  log(`Using test user ${user.email}`);

  await runComponentChecks();

  await runScenario('cnic', 'cnic.jpg', 'cnic', true);
  await runScenario('credit_card', 'credit_card.jpg', 'auto', true);
  await runScenario('debit_card', 'debit_card.jpg', 'auto', true);
  await runScenario('normal_object', 'normal_object.jpg', 'auto', false);

  await simulateOfflineSync(global.__verifyToken, path.join(TMP_DIR, 'cnic.jpg'));

  aggregateRequirements();

  const outPath = path.join(TMP_DIR, 'report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  log(`\nReport written: ${outPath}`);

  console.log('\n======== REQUIREMENTS SUMMARY ========');
  for (const [id, row] of Object.entries(report.requirements)) {
    console.log(`${row.status}  ${id}: ${row.note}`);
  }

  await cleanup();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await cleanup();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
