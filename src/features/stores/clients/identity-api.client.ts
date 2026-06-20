import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { StoreSnapshot } from '../repositories/store.repository.interface';

export const IDENTITY_API_CLIENT = Symbol('IDENTITY_API_CLIENT');

export interface IIdentityApiClient {
  /** Devuelve null si la tienda no existe en Identity (404). */
  fetchStore(storeId: string): Promise<StoreSnapshot | null>;
}

interface IdentityStoreResponseDto {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  status: string;
  isActive: boolean;
  location: string | null;
}

@Injectable()
export class IdentityApiClient implements IIdentityApiClient {
  private readonly logger = new Logger(IdentityApiClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'IDENTITY_SERVICE_URL',
      'http://localhost:3001',
    );
  }

  async fetchStore(storeId: string): Promise<StoreSnapshot | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<IdentityStoreResponseDto>(
          `${this.baseUrl}/internal/stores/${storeId}`,
          { timeout: 5000 },
        ),
      );
      return {
        id: data.id,
        ownerId: data.ownerId,
        name: data.name,
        type: data.type,
        status: data.status,
        isActive: data.isActive,
        location: data.location,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      this.logger.error(
        `Failed to fetch store=${storeId} from identity-service: ${axiosError.message}`,
      );
      throw error;
    }
  }
}
