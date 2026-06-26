/**
 * Configuración del bus de eventos COMPARTIDO de la plataforma ECIExpress.
 *
 * Este es el ÚNICO bus de eventos de products-service: el exchange topic compartido
 * `eciexpress_events`, por el que viajan todos los eventos del servicio — tanto los
 * de integración entre microservicios (cotización de carrito, stock) como los de
 * catálogo (category, item, promotion), que antes usaban la cola directa
 * `products_events` vía NestJS Transport.RMQ (ya eliminada).
 *
 * La URL de conexión llega SIEMPRE por la variable de entorno RABBITMQ_URL.
 */
export const SHARED_EXCHANGE_NAME =
  process.env.RABBITMQ_EXCHANGE ?? 'eciexpress_events';

/** Cola propia de products-service enlazada al exchange compartido. */
export const SHARED_QUEUE_NAME =
  process.env.RABBITMQ_SHARED_QUEUE ?? 'products_service_queue';
