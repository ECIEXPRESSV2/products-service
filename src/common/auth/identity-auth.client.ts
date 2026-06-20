import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface AuthenticatedUser {
  userId: string;
  firebaseUid: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Introspección de token contra identity-service (GET /auth/validate),
 * el mismo endpoint que identity-service documenta para "el API Gateway
 * y los demás microservicios". products-service no verifica el JWT de
 * Firebase por su cuenta — evita duplicar credenciales de Firebase Admin
 * en dos servicios.
 */
@Injectable()
export class IdentityAuthClient {
  private readonly logger = new Logger(IdentityAuthClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'IDENTITY_SERVICE_URL',
      'http://localhost:3001',
    );
  }

  async validate(bearerToken: string): Promise<AuthenticatedUser> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<AuthenticatedUser>(`${this.baseUrl}/auth/validate`, {
          headers: { Authorization: `Bearer ${bearerToken}` },
          timeout: 5000,
        }),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        throw new UnauthorizedException('Token inválido o expirado');
      }
      this.logger.error(`Failed to validate token against identity-service: ${axiosError.message}`);
      throw new UnauthorizedException('No fue posible validar el token con identity-service');
    }
  }
}
