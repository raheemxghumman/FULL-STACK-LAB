import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CategoriesModule } from './categories/categories.module';
import { AppValidationPipe } from './common/pipes';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor';
import { validateEnv } from './config/env.validation';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

/**
 * Root module. The request pipeline, in order:
 *   RequestIdMiddleware (all routes)
 *   -> JwtAuthGuard (global)  -> RolesGuard (global)
 *   -> ResponseEnvelopeInterceptor (global, before)
 *   -> AppValidationPipe (global) + ParsePositiveIntPipe / NonEmptyBodyPipe (parameter scope)
 *   -> controller -> service -> FIXFLOW_STORE
 *   -> ResponseEnvelopeInterceptor (after) -> response
 * Registering them with APP_* providers (instead of app.useGlobal*) lets Nest inject their
 * dependencies, and makes the test application use exactly the same pipeline.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    StorageModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    RequestsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useExisting: JwtAuthGuard }, // 1st guard: authentication
    { provide: APP_GUARD, useExisting: RolesGuard }, // 2nd guard: role
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
