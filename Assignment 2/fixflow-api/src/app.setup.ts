import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Settings shared by main.ts, the tests and the demo scripts, so all of them run the same app:
 * the /api prefix and the Swagger documentation at /api/docs.
 */
export function configureApp(app: INestApplication, { swagger = true } = {}) {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  if (swagger) {
    const config = new DocumentBuilder()
      .setTitle('FixFlow API')
      .setDescription(
        'Campus Maintenance and Service Dispatch System. Assignment 2, Full Stack Web Development (CS-301), Abdul Raheem 241854. ' +
          'Log in with POST /api/auth/login, then press Authorize and paste data.accessToken.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    return document;
  }
  return null;
}
