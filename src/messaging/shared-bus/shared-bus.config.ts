/**
 * Configuración del bus de eventos COMPARTIDO de la plataforma ECIExpress.
 *
 * A diferencia de `messaging/rabbitmq.module.ts` (que usa el transporte NestJS RMQ
 * con la cola privada `products_events` para los eventos internos de catálogo), este
 * módulo se conecta al exchange topic compartido `eciexpress_events`, por el que
 * viajan los eventos entre microservicios (orders, financial, fulfillment, ...).
 *
 * La URL de conexión llega SIEMPRE por la variable de entorno RABBITMQ_URL.
 */
export const SHARED_EXCHANGE_NAME =
  process.env.RABBITMQ_EXCHANGE ?? 'eciexpress_events';

/** Cola propia de products-service enlazada al exchange compartido. */
export const SHARED_QUEUE_NAME =
  process.env.RABBITMQ_SHARED_QUEUE ?? 'products_service_queue';
