/**
 * 785 Magazine — Sanity Importer
 *
 * Reads the JSON files from ./output/ and pushes them to your Sanity project.
 *
 * Prerequisites:
 *   1. npm install @sanity/client
 *   2. Set env vars (or edit the config below):
 *        SANITY_PROJECT_ID=your_project_id
 *        SANITY_DATASET=production
 *        SANITY_TOKEN=your_write_token   ← get from sanity.io/manage
 *
 * Usage:
 *   node import-to-sanity.js              — imports everything
 *   node import-to-sanity.js --authors    — authors only
 *   node import-to-sanity.js --categories — categories only
 *   node import-to-sanity.js --posts      — posts only
 *   node import-to-sanity.js --dry-run    — preview without writing
 */

const { createClient } = require('@sanity/client');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────

const config = {
  projectId: process.env.SANITY_PROJECT_ID || 'YOUR_PROJECT_ID',
  dataset: process.env.SANITY_DATASET || 'production',
  token: process.env.SANITY_TOKEN || 'YOUR_WRITE_TOKEN',
  apiVersion: '2024-01-01',
  useCdn: false,
};

const OUTPUT_DIR = path.join(__dirname, 'output');
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_AUTHORS = process.argv.includes('--authors');
const ONLY_CATEGORIES = process.argv.includes('--categories');
const ONLY_POSTS = process.argv.includes('--posts');
const BATCH_SIZE = 50; // Sanity handles up to 250 mutations at once

// ─── Helpers ───────────────────────────────────────────────────────────────

function readJSON(filename) {
  const filepath = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    console.error('   Run parse-xml.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function batchImport(client, docs, label) {
  const batches = chunk(docs, BATCH_SIZE);
  let imported = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`   ${label}: batch ${i + 1}/${batches.length} (${imported + batch.length}/${docs.length})...`);

    if (!DRY_RUN) {
      const transaction = client.transaction();
      for (const doc of batch) {
        // createOrReplace so re-running is safe
        transaction.createOrReplace(doc);
      }
      await transaction.commit();
    }

    imported += batch.length;
    process.stdout.write(' ✓\n');
  }

  return imported;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('\n🔍 DRY RUN — no data will be written\n');

  if (config.projectId === 'YOUR_PROJECT_ID') {
    console.error('❌ Set SANITY_PROJECT_ID env var or edit config in this file');
    process.exit(1);
  }

  const client = createClient(config);
  console.log(`\n🚀 Importing to Sanity project: ${config.projectId} (${config.dataset})\n`);

  // ── 1. Authors ────────────────────────────────────────────────────────────
  if (!ONLY_CATEGORIES && !ONLY_POSTS) {
    const authors = readJSON('authors.json');
    console.log(`👤 Authors: ${authors.length} found`);
    const count = await batchImport(client, authors, 'Authors');
    console.log(`   → ${count} authors imported\n`);
  }

  // ── 2. Categories ─────────────────────────────────────────────────────────
  if (!ONLY_AUTHORS && !ONLY_POSTS) {
    const categories = readJSON('categories.json');
    console.log(`🏷️  Categories/Tags: ${categories.length} found`);
    const count = await batchImport(client, categories, 'Categories');
    console.log(`   → ${count} categories imported\n`);
  }

  // ── 3. Posts ──────────────────────────────────────────────────────────────
  if (!ONLY_AUTHORS && !ONLY_CATEGORIES) {
    const posts = readJSON('posts.json');
    const published = posts.filter(p => p.status === 'published');
    const drafts = posts.filter(p => p.status === 'draft');

    console.log(`📝 Posts: ${posts.length} total (${published.length} published, ${drafts.length} drafts)`);
    const count = await batchImport(client, posts, 'Posts');
    console.log(`   → ${count} posts imported\n`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('✅ Dry run complete — no data was written');
  } else {
    console.log('✅ Import complete!');
    console.log('\nNext steps:');
    console.log('  1. Open Sanity Studio and verify the content looks right');
    console.log('  2. Check output/missing-images.txt — those images need manual recovery');
    console.log('  3. Start linking posts to Heyzine magazine issues in Studio');
    console.log('  4. Run with other XML files using the same process\n');
  }
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message);
  process.exit(1);
});
