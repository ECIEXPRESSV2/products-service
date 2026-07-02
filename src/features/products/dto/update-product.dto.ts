import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { CreateProductDto } from './create-product.dto';
import { ProductGenerationStatus } from '../product-generation-status';

export class UpdateProductDto extends PartialType(CreateProductDto) {
	storeId?: string;
	categoryId?: string;
	name?: string;
	slug?: string;
	description?: string;
	price?: number;
	sku?: string;
	imageUrl?: string;
	stock?: number;
	minStock?: number;
	isActive?: boolean;
	sortOrder?: number;

	@ApiPropertyOptional({
		description: 'URL de la imagen frontal del producto',
		example: 'https://cdn.example.com/products/cafe/front.jpg',
		maxLength: 500,
	})
	@IsUrl()
	@IsOptional()
	@MaxLength(500)
	frontImageUrl?: string;

	@ApiPropertyOptional({
		description: 'URL de la imagen lateral del producto',
		example: 'https://cdn.example.com/products/cafe/left.jpg',
		maxLength: 500,
	})
	@IsUrl()
	@IsOptional()
	@MaxLength(500)
	leftImageUrl?: string;

	@ApiPropertyOptional({
		description: 'URL de la imagen trasera del producto',
		example: 'https://cdn.example.com/products/cafe/back.jpg',
		maxLength: 500,
	})
	@IsUrl()
	@IsOptional()
	@MaxLength(500)
	backImageUrl?: string;

	@ApiPropertyOptional({
		description: 'URL del modelo 3D generado',
		example: 'https://cdn.example.com/products/cafe/model.glb',
		maxLength: 500,
	})
	@IsUrl()
	@IsOptional()
	@MaxLength(500)
	model3dUrl?: string;

	@ApiPropertyOptional({
		description: 'Estado del modelo 3D',
		enum: ProductGenerationStatus,
		example: ProductGenerationStatus.PROCESSING,
	})
	@IsEnum(ProductGenerationStatus)
	@IsOptional()
	modelGenerationStatus?: ProductGenerationStatus;

	@ApiPropertyOptional({
		description: 'Progreso de generación 3D en porcentaje',
		example: 50,
		minimum: 0,
		maximum: 100,
	})
	@IsInt()
	@Min(0)
	@IsOptional()
	modelGenerationProgress?: number;

	@ApiPropertyOptional({
		description: 'Último error del proceso 3D',
		example: 'La IA no respondió a tiempo',
	})
	@IsString()
	@IsOptional()
	modelGenerationError?: string | null;
}
