/**
 * 785 Magazine — WordPress XML → Sanity JSON Parser
 *
 * Usage: node parse-xml.js ./seveneightfive_WordPress_2025-02-18.xml
 *
 * Outputs to ./output/
 *   posts.json     — all posts ready for Sanity import
 *   authors.json   — all unique authors
 *   categories.json — all unique categories/tags
 *   missing-images.txt — images that couldn't be resolved (handle manually)
 */

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

// ─── Config ────────────────────────────────────────────────────────────────

const LOREM_PHRASES = [
  'lorem ipsum', 'doloremque laudantium', 'quis nostrum',
  'cumque nihil impedit', 'vel illum qui dolorem',
];

const DISCARD_CATEGORIES = []; // add any category names you want to drop

// ─── Helpers ───────────────────────────────────────────────────────────────

function isLoremIpsum(title = '', content = '') {
  const text = (title + ' ' + content).toLowerCase();
  return LOREM_PHRASES.some(phrase => text.includes(phrase));
}

function slugify(text = '') {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function authorId(name) {
  return 'author-' + slugify(name);
}

function categoryId(name) {
  return 'category-' + slugify(name);
}

/**
 * Convert WordPress block HTML to Sanity Portable Text (simplified).
 * For full fidelity you'd use @sanity/block-content-to-react on the
 * receiving end, but this gives you clean importable blocks.
 */
function htmlToPortableText(html = '') {
  if (!html) return [];

  // Strip WP block comments
  const clean = html
    .replace(/<!-- \/?wp:[^>]+-->/g, '')
    .trim();

  // Split into paragraph-like chunks
  const blocks = [];
  const paragraphs = clean.split(/\n{2,}/);

  for (const para of paragraphs) {
    const stripped = para
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!stripped) continue;

    // Detect headings
    const headingMatch = para.match(/^<h([1-6])[^>]*>(.*?)<\/h\1>/i);
    if (headingMatch) {
      const level = parseInt(headingMatch[1]);
      const text = headingMatch[2].replace(/<[^>]+>/g, '').trim();
      blocks.push({
        _type: 'block',
        style: `h${level}`,
        children: [{ _type: 'span', text }],
        markDefs: [],
      });
      continue;
    }

    // Regular paragraph
    if (stripped.length > 0) {
      blocks.push({
        _type: 'block',
        style: 'normal',
        children: [{ _type: 'span', text: stripped }],
        markDefs: [],
      });
    }
  }

  return blocks;
}

/**
 * Extract all image URLs from a post's content.
 * Returns array of { original, rewritten } where rewritten attempts
 * to use 785mag.com domain (in case staging is down).
 */
function extractImages(content = '') {
  const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
  const matches = [...new Set(content.match(imgRegex) || [])];

  return matches.map(url => {
    const rewritten = url
      .replace('staging26.seveneightfive.com', '785mag.com')
      .replace('www.staging26.seveneightfive.com', '785mag.com');
    return { original: url, rewritten };
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

function parseWordPressXML(xmlFilePath) {
  console.log(`\n📂 Reading: ${xmlFilePath}`);
  const xml = fs.readFileSync(xmlFilePath, 'utf8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    allowBooleanAttributes: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xml);
  const channel = parsed.rss.channel;
  const rawItems = Array.isArray(channel.item) ? channel.item : [channel.item];

  // ── Authors ──────────────────────────────────────────────────────────────
  const rawAuthors = Array.isArray(channel['wp:author'])
    ? channel['wp:author']
    : [channel['wp:author']].filter(Boolean);

  const authors = rawAuthors.map(a => ({
    _type: 'author',
    _id: authorId(a['wp:author_display_name']?.__cdata || a['wp:author_login']?.__cdata || 'unknown'),
    name: a['wp:author_display_name']?.__cdata || a['wp:author_login']?.__cdata || 'Unknown',
    login: a['wp:author_login']?.__cdata || '',
    email: a['wp:author_email']?.__cdata || '',
  }));

  console.log(`👤 Found ${authors.length} authors`);

  // ── Filter items ─────────────────────────────────────────────────────────
  const posts = [];
  const allCategories = new Map();
  const missingImages = [];

  let skippedLorem = 0;
  let skippedAttachment = 0;
  let skippedRevision = 0;
  let importedPublished = 0;
  let importedDraft = 0;

  for (const item of rawItems) {
    const postType = item['wp:post_type']?.__cdata || item['wp:post_type'];
    const status = item['wp:status']?.__cdata || item['wp:status'];

    // Skip non-post types
    if (postType === 'attachment') { skippedAttachment++; continue; }
    if (postType === 'revision') { skippedRevision++; continue; }
    if (postType !== 'post') continue;

    // Skip everything except publish and draft
    if (!['publish', 'draft'].includes(status)) continue;

    const title = item.title?.__cdata || item.title || '';
    const content = item['content:encoded']?.__cdata || item['content:encoded'] || '';

    // Skip lorem ipsum
    if (isLoremIpsum(title, content)) { skippedLorem++; continue; }

    // ── Categories & Tags ─────────────────────────────────────────────────
    const itemCats = Array.isArray(item.category)
      ? item.category
      : item.category ? [item.category] : [];

    const postCategories = [];
    const postTags = [];

    for (const cat of itemCats) {
      const name = cat.__cdata || cat;
      const domain = cat['@_domain'] || '';
      const nicename = cat['@_nicename'] || slugify(name);

      if (!name) continue;

      const id = categoryId(name);
      if (!allCategories.has(id)) {
        allCategories.set(id, {
          _type: domain === 'post_tag' ? 'tag' : 'category',
          _id: id,
          name,
          slug: { current: nicename || slugify(name) },
        });
      }

      if (domain === 'post_tag') {
        postTags.push({ _type: 'reference', _ref: id });
      } else {
        postCategories.push({ _type: 'reference', _ref: id });
      }
    }

    // ── Images ────────────────────────────────────────────────────────────
    const images = extractImages(content);
    if (images.length > 0) {
      missingImages.push({
        postTitle: title,
        postSlug: item['wp:post_name']?.__cdata || slugify(title),
        images: images.map(i => i.original),
      });
    }

    // ── Build Sanity document ─────────────────────────────────────────────
    const wpId = item['wp:post_id'];
    const slug = item['wp:post_name']?.__cdata || slugify(title);
    const pubDate = item.pubDate || item['wp:post_date']?.__cdata || '';
    const creatorName = item['dc:creator']?.__cdata || item['dc:creator'] || '';
    const excerpt = item['excerpt:encoded']?.__cdata || '';

    const sanityDoc = {
      _type: 'post',
      _id: `wp-post-${wpId}`,
      title,
      slug: { _type: 'slug', current: slug },
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
      status: status === 'publish' ? 'published' : 'draft',
      author: creatorName
        ? { _type: 'reference', _ref: authorId(creatorName) }
        : null,
      categories: postCategories,
      tags: postTags,
      excerpt: excerpt || '',
      body: htmlToPortableText(content),
      // Placeholder for Heyzine magazine issue — fill in Sanity Studio
      magazineIssue: null,
      // Keep original WP metadata for reference
      _wpMeta: {
        wpId: String(wpId),
        originalUrl: item.link || item.guid?.__cdata || '',
        importedAt: new Date().toISOString(),
      },
    };

    posts.push(sanityDoc);
    if (status === 'publish') importedPublished++;
    else importedDraft++;
  }

  // ── Output ────────────────────────────────────────────────────────────────
  const outputDir = path.join(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'posts.json'),
    JSON.stringify(posts, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'authors.json'),
    JSON.stringify(authors, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'categories.json'),
    JSON.stringify([...allCategories.values()], null, 2)
  );

  // Missing images report
  const imageReport = missingImages
    .map(p => [
      `POST: ${p.postTitle}`,
      `SLUG: ${p.postSlug}`,
      ...p.images.map(u => `  IMAGE: ${u}`),
      '',
    ].join('\n'))
    .join('\n');

  fs.writeFileSync(
    path.join(outputDir, 'missing-images.txt'),
    `# Images to retrieve manually\n# These are referenced in posts but need to be\n# uploaded to Sanity separately.\n# See IMAGES.md for instructions.\n\n${imageReport}`
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Parse complete!\n');
  console.log(`   Published posts imported : ${importedPublished}`);
  console.log(`   Draft posts imported     : ${importedDraft}`);
  console.log(`   Lorem ipsum skipped      : ${skippedLorem}`);
  console.log(`   Attachments skipped      : ${skippedAttachment}`);
  console.log(`   Revisions skipped        : ${skippedRevision}`);
  console.log(`   Authors                  : ${authors.length}`);
  console.log(`   Categories/Tags          : ${allCategories.size}`);
  console.log(`   Posts with images        : ${missingImages.length}`);
  console.log(`\n📁 Output written to: ${outputDir}/`);
  console.log('   posts.json');
  console.log('   authors.json');
  console.log('   categories.json');
  console.log('   missing-images.txt  ← review this for image recovery\n');
}

// ─── Run ───────────────────────────────────────────────────────────────────

const xmlPath = process.argv[2];
if (!xmlPath) {
  console.error('Usage: node parse-xml.js path/to/export.xml');
  process.exit(1);
}

parseWordPressXML(path.resolve(xmlPath));
