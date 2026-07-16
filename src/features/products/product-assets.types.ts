export type ProductImageVariant = 'front' | 'left' | 'back';

export interface ProductImageFile {
  originalname: string;
  mimetype: string;
  buffer: Uint8Array;
}

export interface ProductImageFiles {
  front?: ProductImageFile[];
  left?: ProductImageFile[];
  back?: ProductImageFile[];
}

// `left`/`back` son opcionales: el vendedor puede crear el producto con solo la
// foto frontal (modelo 3D de una vista) o con las 3 vistas (modelo más preciso).
export interface ProductImageSet {
  front: ProductImageFile;
  left?: ProductImageFile;
  back?: ProductImageFile;
}

export interface GeneratedModelArtifact {
  kind: 'url' | 'base64';
  value: string;
  contentType?: string;
  fileName?: string;
}
