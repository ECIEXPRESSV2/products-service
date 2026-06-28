/**
 * Configuración del bus de eventos COMPARTIDO de la plataforma ECIExpress
 * (Azure Service Bus).
 *
 * Este es el ÚNICO bus de eventos de products-service: el topic compartido
 * `eciexpress_events`, por el que viajan todos los eventos del servicio — tanto los
 * de integración entre microservicios (cotización de carrito, stock) como los de
 * catálogo (category, item, promotion).
 *
 * Autenticación PASSWORDLESS (Managed Identity vía DefaultAzureCredential): solo se
 * necesita el FQDN del namespace, nunca una connection string en el código. Los valores
 * llegan por entorno (inyectados por Terraform en el Container App):
 *   SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE = <namespace>.servicebus.windows.net
 *   SERVICE_BUS_TOPIC                      = eciexpress_events
 *   SERVICE_BUS_SUBSCRIPTION               = products-service
 */
export const SHARED_TOPIC_NAME =
  process.env.SERVICE_BUS_TOPIC ?? 'eciexpress_events';

/** Subscription propia de products-service sobre el topic compartido. */
export const SHARED_SUBSCRIPTION_NAME =
  process.env.SERVICE_BUS_SUBSCRIPTION ?? 'products-service';
