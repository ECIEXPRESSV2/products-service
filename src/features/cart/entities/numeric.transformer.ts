import { ValueTransformer } from 'typeorm';

/**
 * Convierte columnas `bigint` (que el driver de Postgres devuelve como string) a
 * `number` de JS y viceversa. Los montos en centavos COP caben sin pérdida en el
 * rango seguro de Number.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null | undefined =>
    value === null || value === undefined ? value : Number(value),
};
