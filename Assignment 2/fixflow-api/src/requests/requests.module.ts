import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { RequestAccessPolicy } from './request-access.policy';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [StorageModule, CategoriesModule, UsersModule],
  controllers: [RequestsController],
  providers: [RequestsService, RequestAccessPolicy],
  exports: [RequestAccessPolicy],
})
export class RequestsModule {}
