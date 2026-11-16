import { Module } from '@nestjs/common';
import { FIXFLOW_STORE } from './fixflow-store.interface';
import { InMemoryFixflowStore } from './in-memory-fixflow.store';
import { SeedService } from './seed.service';

/**
 * Binds the storage contract to an implementation:
 *   { provide: FIXFLOW_STORE, useClass: InMemoryFixflowStore }
 * Modules that need storage import StorageModule and inject the token. To use another store,
 * only this binding changes (or a test overrides it with .overrideProvider(FIXFLOW_STORE)).
 */
@Module({
  providers: [{ provide: FIXFLOW_STORE, useClass: InMemoryFixflowStore }, SeedService],
  exports: [FIXFLOW_STORE],
})
export class StorageModule {}
