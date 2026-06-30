import TransportStream from 'winston-transport';
import { Contracts } from 'applicationinsights';
import { getTelemetryClient } from '../telemetry/app-insights';
import { SERVICE_NAME } from '../telemetry/service-name';
import { loggingStorage } from './logging.context';

// Mapea los niveles de Winston (npm levels) a SeverityLevel de Application Insights.
const SEVERITY: Record<string, Contracts.SeverityLevel> = {
  error: Contracts.SeverityLevel.Error,
  warn: Contracts.SeverityLevel.Warning,
  info: Contracts.SeverityLevel.Information,
  http: Contracts.SeverityLevel.Information,
  verbose: Contracts.SeverityLevel.Verbose,
  debug: Contracts.SeverityLevel.Verbose,
  silly: Contracts.SeverityLevel.Verbose,
};

/**
 * Transporte de Winston que reenvía cada log a Application Insights como trackTrace,
 * añadiendo:
 *   - serviceName  -> customDimensions.serviceName (qué microservicio emitió el log)
 *   - userId       -> customDimensions.userId      (trazabilidad por usuario, vía
 *                     AsyncLocalStorage que rellena LoggingMiddleware con x-user-id)
 *
 * Es un no-op si Application Insights no está configurado (local/tests).
 */
export class AppInsightsTransport extends TransportStream {
  log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const client = getTelemetryClient();
    if (!client) {
      callback();
      return;
    }

    const { level, message, stack, context, timestamp, ...meta } = info;
    const userId = loggingStorage.getStore()?.userId;

    const properties: Record<string, string> = { serviceName: SERVICE_NAME };
    if (userId) properties.userId = userId;
    if (typeof context === 'string') properties.context = context;
    if (typeof stack === 'string') properties.stack = stack;
    // Resto de metadatos del log (objetos -> JSON) como propiedades adicionales.
    for (const [key, value] of Object.entries(meta)) {
      if (value === undefined || value === null) continue;
      properties[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    client.trackTrace({
      message:
        typeof message === 'string' ? message : JSON.stringify(message ?? ''),
      severity: SEVERITY[String(level)] ?? Contracts.SeverityLevel.Information,
      properties,
    });

    callback();
  }
}
