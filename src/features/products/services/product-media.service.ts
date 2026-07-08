import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import axios from 'axios';
import { extname } from 'node:path';
import type { GeneratedModelArtifact, ProductImageFile, ProductImageFiles, ProductImageSet, ProductImageVariant } from '../product-assets.types';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

@Injectable()
export class ProductMediaService {
  constructor(private readonly configService: ConfigService) {}

  private get connectionString(): string {
    const value = this.configService.get<string>('blob.connectionString') ?? process.env.BLOB_CONNECTION_STRING ?? '';
    return value.trim();
  }

  // Contenedor ÚNICO para imágenes y modelos de producto. Distribución de rutas:
  //   products/<productId>/images/<front|left|back>.<ext>
  //   products/<productId>/models/model.glb
  private get containerName(): string {
    return (this.configService.get<string>('blob.productsContainer') ?? process.env.BLOB_PRODUCTS_CONTAINER ?? 'products').trim();
  }

  private get aiGenerateUrl(): string {
    return (this.configService.get<string>('productAssets.aiGenerateUrl') ?? process.env.PRODUCT_AI_GENERATE_URL ?? '').trim();
  }

  private get aiTimeoutMs(): number {
    const raw = this.configService.get<string>('productAssets.aiTimeoutMs') ?? process.env.PRODUCT_AI_TIMEOUT_MS;
    const parsed = raw ? Number(raw) : 10 * 60 * 1000;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60 * 1000;
  }

  private get blobServiceClient(): BlobServiceClient {
    if (!this.connectionString) {
      throw new Error('BLOB_CONNECTION_STRING no está configurada');
    }
    return BlobServiceClient.fromConnectionString(this.connectionString);
  }

  private get sharedKeyCredential(): StorageSharedKeyCredential {
    const match = /(?:^|;)AccountName=([^;]+);(?:.*?;)AccountKey=([^;]+)/i.exec(this.connectionString);
    if (!match) {
      throw new Error('BLOB_CONNECTION_STRING no contiene AccountName/AccountKey válidos');
    }
    return new StorageSharedKeyCredential(match[1], match[2]);
  }

  private async getContainerClient() {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    // Acceso anónimo a nivel "blob" (lectura pública por URL), como el contenedor de tiendas.
    await containerClient.createIfNotExists({ access: 'blob' });
    return containerClient;
  }

  validateImages(files: ProductImageFiles): ProductImageSet {
    const front = files.front?.[0];
    const left = files.left?.[0];
    const back = files.back?.[0];

    if (!front || !left || !back) {
      throw new BadRequestException('Debes subir 3 imágenes: frontal, lateral y trasera');
    }

    this.validateImageFile(front, 'frontal');
    this.validateImageFile(left, 'lateral');
    this.validateImageFile(back, 'trasera');

    return { front, left, back };
  }

  private validateImageFile(file: ProductImageFile, label: string): void {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      throw new BadRequestException(`La imagen ${label} debe ser JPG, JPEG o PNG`);
    }
  }

  private extensionFor(file: ProductImageFile): string {
    const originalExtension = extname(file.originalname).toLowerCase().replace('.', '');
    if (originalExtension === 'jpg' || originalExtension === 'jpeg' || originalExtension === 'png') {
      return originalExtension === 'jpg' ? 'jpg' : originalExtension;
    }
    if (file.mimetype === 'image/png') return 'png';
    return 'jpg';
  }

  private async uploadBuffer(
    blobName: string,
    buffer: Uint8Array,
    contentType: string,
    containerClient = this.getContainerClient(),
  ): Promise<string> {
    const resolvedContainerClient = await containerClient;
    const blobClient = resolvedContainerClient.getBlockBlobClient(blobName);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return blobClient.url;
  }

  private isBlobStorageUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'https:' && parsed.hostname.endsWith('.blob.core.windows.net');
    } catch {
      return false;
    }
  }

  toAccessibleUrl(rawUrl: string | null | undefined, expiresInHours = 168): string | null {
    if (!rawUrl) return null;
    if (!this.isBlobStorageUrl(rawUrl)) return rawUrl;

    try {
      const parsed = new URL(rawUrl);
      if (parsed.searchParams.has('sig')) {
        return rawUrl;
      }

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const [containerName, ...blobParts] = pathParts;
      if (!containerName || blobParts.length === 0) {
        return rawUrl;
      }

      const blobName = decodeURIComponent(blobParts.join('/'));
      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse('r'),
          startsOn: new Date(Date.now() - 5 * 60 * 1000),
          expiresOn: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        },
        this.sharedKeyCredential,
      ).toString();

      return `${parsed.origin}${parsed.pathname}?${sas}`;
    } catch {
      return rawUrl;
    }
  }

  async uploadProductImage(
    productId: string,
    variant: ProductImageVariant,
    file: ProductImageFile,
  ): Promise<string> {
    this.validateImageFile(file, variant);
    const extension = this.extensionFor(file);
    // products/<id>/images/<front|left|back>.<ext> (nombre fijo por vista → se sobrescribe al actualizar).
    return this.uploadBuffer(
      `${productId}/images/${variant}.${extension}`,
      file.buffer,
      file.mimetype,
    );
  }

  async uploadProductImages(productId: string, files: ProductImageSet): Promise<Record<ProductImageVariant, string>> {
    const [front, left, back] = await Promise.all([
      this.uploadProductImage(productId, 'front', files.front),
      this.uploadProductImage(productId, 'left', files.left),
      this.uploadProductImage(productId, 'back', files.back),
    ]);

    return { front, left, back };
  }

  private normalizeBase64(input: string): string {
    return input.replace(/^data:[^;]+;base64,/, '');
  }

  private resolveGeneratedArtifact(payload: unknown): GeneratedModelArtifact {
    if (typeof payload === 'string') {
      if (/^https?:\/\//i.test(payload)) {
        return { kind: 'url', value: payload };
      }
      return { kind: 'base64', value: this.normalizeBase64(payload), fileName: 'product-model.glb', contentType: 'model/gltf-binary' };
    }

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const url =
        (record.modelUrl as string | undefined) ??
        (record.url as string | undefined) ??
        (record.downloadUrl as string | undefined) ??
        (record.fileUrl as string | undefined);
      if (typeof url === 'string' && url.trim()) {
        return { kind: 'url', value: url.trim() };
      }

      const base64 =
        (record.modelBase64 as string | undefined) ??
        (record.glbBase64 as string | undefined) ??
        (record.base64 as string | undefined) ??
        (record.data as string | undefined) ??
        (record.model as string | undefined);
      if (typeof base64 === 'string' && base64.trim()) {
        return {
          kind: 'base64',
          value: this.normalizeBase64(base64.trim()),
          fileName:
            (record.fileName as string | undefined) ??
            (record.filename as string | undefined) ??
            'product-model.glb',
          contentType:
            (record.contentType as string | undefined) ??
            'model/gltf-binary',
        };
      }
    }

    throw new Error('La IA no devolvió un modelo 3D válido');
  }

  private async uploadModelArtifact(
    productId: string,
    artifact: GeneratedModelArtifact,
  ): Promise<string> {
    if (artifact.kind === 'url') {
      return artifact.value;
    }

    // products/<id>/models/model.glb (nombre fijo → un solo modelo por producto, se sobrescribe).
    return this.uploadBuffer(
      `${productId}/models/model.glb`,
      Buffer.from(artifact.value, 'base64'),
      artifact.contentType ?? 'model/gltf-binary',
    );
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.aiGenerateUrl) return false;
    try {
      await axios.head(this.aiGenerateUrl, { timeout: 5000 });
      return true;
    } catch {
      try {
        await axios.get(this.aiGenerateUrl, { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  async generateAndUploadModel3d(productId: string, files: ProductImageSet): Promise<string> {
    if (!this.aiGenerateUrl) {
      throw new Error('PRODUCT_AI_GENERATE_URL no está configurada');
    }

    const payload = {
      images: {
        front: Buffer.from(files.front.buffer).toString('base64'),
        left: Buffer.from(files.left.buffer).toString('base64'),
        back: Buffer.from(files.back.buffer).toString('base64'),
      },
      texture: true,
      num_inference_steps: 50,
      guidance_scale: 7.5,
      octree_resolution: 380,
      seed: 1234,
    };

    const response = await axios.post(this.aiGenerateUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: this.aiTimeoutMs,
      responseType: 'arraybuffer',
      validateStatus: (status) => status >= 200 && status < 300,
    });

    // response.data es ya un arraybuffer, conviertelo a Buffer
    const glbBuffer = Buffer.from(response.data);

    // products/<id>/models/model.glb (nombre fijo → un solo modelo por producto, se sobrescribe).
    return this.uploadBuffer(
      `${productId}/models/model.glb`,
      glbBuffer,
      'model/gltf-binary',
    );
  }
}
