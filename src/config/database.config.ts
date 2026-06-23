import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Configuración de TypeORM para PostgreSQL.
 *
 * Si está definida `DATABASE_URL` (p. ej. NeonDB en Render/producción) se usa la
 * cadena de conexión con SSL. Si no, se construye desde las variables `DB_*`
 * (desarrollo local). Esto evita el ECONNREFUSED de despliegue en el que, al faltar
 * las `DB_*`, se caía al default `localhost:5432`.
 */
export default registerAs('database', (): TypeOrmModuleOptions => {
  const common = {
    type: 'postgres' as const,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  };

  if (process.env.DATABASE_URL) {
    return {
      ...common,
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true }, // NeonDB requiere SSL (sslmode=require)
    };
  }

  return {
    ...common,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'products_service',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
});
