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

export interface ProductImageSet {
  front: ProductImageFile;
  left: ProductImageFile;
  back: ProductImageFile;
}

export interface GeneratedModelArtifact {
  kind: 'url' | 'base64';
  value: string;
  contentType?: string;
  fileName?: string;
}
