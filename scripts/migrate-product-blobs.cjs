/**
 * Migración única: mueve las imágenes/modelos de producto de los contenedores viejos
 *   product-images/products/<id>/<front|left|back>.<ext>  →  products/<id>/images/<front|left|back>.<ext>
 *   product-models/models/<id>/product-model.glb          →  products/<id>/models/model.glb
 * y reapunta las URLs en la BD (tabla products: image_url, front/left/back_image_url, model_3d_url).
 *
 * Idempotente: si una URL ya apunta al contenedor `products`, se deja igual. NO borra los viejos.
 *
 * Uso (Node plano; NO altera el build de nest):
 *   node scripts/migrate-product-blobs.cjs --dry-run   # previsualiza
 *   node scripts/migrate-product-blobs.cjs             # aplica
 *
 * Requiere en el entorno: DATABASE_URL, BLOB_CONNECTION_STRING.
 */
const { Client } = require('pg');
const { BlobServiceClient } = require('@azure/storage-blob');

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_CONTAINER = process.env.BLOB_PRODUCTS_CONTAINER || 'products';
const OLD_IMAGES = 'product-images';
const OLD_MODELS = 'product-models';

// Parsea una URL de blob → { container, blobName } (sin querystring). null si no es blob.
function parseBlob(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith('.blob.core.windows.net')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { container: parts[0], blobName: decodeURIComponent(parts.slice(1).join('/')) };
  } catch {
    return null;
  }
}

async function main() {
  const connStr = process.env.BLOB_CONNECTION_STRING;
  if (!connStr) throw new Error('Falta BLOB_CONNECTION_STRING');
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');

  const blobSvc = BlobServiceClient.fromConnectionString(connStr);
  const target = blobSvc.getContainerClient(TARGET_CONTAINER);

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  console.log(`\n${DRY_RUN ? '🔍 DRY-RUN (no escribe nada)' : '🚀 MIGRANDO'} → contenedor destino: ${TARGET_CONTAINER}\n`);

  // Copia un blob viejo al contenedor nuevo en destPath (download + upload, preserva content-type).
  // Devuelve la URL nueva, o la misma si ya estaba en el contenedor nuevo, o null si no aplica.
  async function migrateOne(rawUrl, destPath) {
    const parsed = parseBlob(rawUrl);
    if (!parsed) return rawUrl ?? null;             // no es blob → dejar igual
    if (parsed.container === TARGET_CONTAINER) return rawUrl; // ya migrado
    if (parsed.container !== OLD_IMAGES && parsed.container !== OLD_MODELS) return rawUrl;

    const newUrl = `${target.url}/${destPath}`;
    if (DRY_RUN) return newUrl;

    const src = blobSvc.getContainerClient(parsed.container).getBlockBlobClient(parsed.blobName);
    const props = await src.getProperties();
    const buffer = await src.downloadToBuffer();
    await target.getBlockBlobClient(destPath).uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: props.contentType || 'application/octet-stream' },
    });
    return newUrl;
  }

  const ext = (blobName, fallback) => {
    const m = /\.([a-z0-9]+)$/i.exec(blobName || '');
    return m ? m[1].toLowerCase() : fallback;
  };

  const { rows } = await db.query(
    `SELECT id, image_url, front_image_url, left_image_url, back_image_url, model_3d_url
     FROM products
     WHERE image_url LIKE '%/product-images/%' OR front_image_url LIKE '%/product-images/%'
        OR left_image_url LIKE '%/product-images/%' OR back_image_url LIKE '%/product-images/%'
        OR model_3d_url LIKE '%/product-models/%'`,
  );

  console.log(`Productos con media en contenedores viejos: ${rows.length}\n`);

  let copied = 0;
  let updated = 0;

  for (const p of rows) {
    const variants = [
      ['front_image_url', 'front', p.front_image_url],
      ['left_image_url', 'left', p.left_image_url],
      ['back_image_url', 'back', p.back_image_url],
    ];

    const next = {};
    for (const [col, variant, url] of variants) {
      const parsed = parseBlob(url);
      if (parsed && (parsed.container === OLD_IMAGES)) {
        const dest = `${p.id}/images/${variant}.${ext(parsed.blobName, 'png')}`;
        next[col] = await migrateOne(url, dest);
        if (!DRY_RUN) copied++;
      }
    }

    // image_url (miniatura) = la vista frontal ya migrada.
    if (next.front_image_url) next.image_url = next.front_image_url;
    else {
      const parsedImg = parseBlob(p.image_url);
      if (parsedImg && parsedImg.container === OLD_IMAGES) {
        const dest = `${p.id}/images/front.${ext(parsedImg.blobName, 'png')}`;
        next.image_url = await migrateOne(p.image_url, dest);
        if (!DRY_RUN) copied++;
      }
    }

    // Modelo 3D.
    const parsedModel = parseBlob(p.model_3d_url);
    if (parsedModel && parsedModel.container === OLD_MODELS) {
      next.model_3d_url = await migrateOne(p.model_3d_url, `${p.id}/models/model.glb`);
      if (!DRY_RUN) copied++;
    }

    const cols = Object.keys(next);
    console.log(`  • ${p.id}  →  ${cols.length ? cols.join(', ') : '(nada)'}`);

    if (!DRY_RUN && cols.length) {
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      await db.query(`UPDATE products SET ${sets} WHERE id = $1`, [p.id, ...cols.map((c) => next[c])]);
      updated++;
    }
  }

  const { rows: leftover } = await db.query(
    `SELECT count(*)::int AS n FROM products
     WHERE image_url LIKE '%/product-images/%' OR front_image_url LIKE '%/product-images/%'
        OR left_image_url LIKE '%/product-images/%' OR back_image_url LIKE '%/product-images/%'
        OR model_3d_url LIKE '%/product-models/%'`,
  );

  console.log('\n──────────────────────────────────────────');
  console.log(`Blobs copiados:            ${copied}`);
  console.log(`Filas de BD actualizadas:  ${updated}`);
  console.log(`Productos con URL vieja restante: ${leftover[0].n}`);
  console.log('──────────────────────────────────────────\n');

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
