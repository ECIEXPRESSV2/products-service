import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Products Service')
    .setDescription(
      `
## Products Service API

Microservicio de gestión de productos para una plataforma multi-tienda.

### Características principales
- **Categorías**: CRUD completo con soporte de jerarquía padre-hijo
- **Multi-tienda**: Cada tienda posee su propio árbol de categorías aislado
- **Soft Delete**: Las eliminaciones desactivan el registro sin borrarlo físicamente
- **Auditoría**: Cada mutación queda registrada en la tabla \`audit_logs\`
- **Eventos**: Cada operación publica un evento en RabbitMQ (\`products_events\`)

### Autenticación
Requiere \`Authorization: Bearer <token Firebase>\`. El token se valida por introspección
contra \`GET /auth/validate\` en identity-service (no se verifica Firebase localmente).
Autorización por rol (\`BUYER\`, \`VENDOR\`, \`ADMIN\`, \`ANALYST\`) vía \`@RequireRoles\`; \`ADMIN\`
siempre tiene acceso.
      `.trim(),
    )
    .setVersion('1.0.0')
    .setContact('Backend Team', '', 'backend@products-service.io')
    .setLicense('UNLICENSED', '')
    .addBearerAuth()
    .addTag('Categories', 'Gestión de categorías de productos')
    .addTag('Audit', 'Consulta de registros de auditoría')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local development')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Products Service — API Docs',
  });
}
