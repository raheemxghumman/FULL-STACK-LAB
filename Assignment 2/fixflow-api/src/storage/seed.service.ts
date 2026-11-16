import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXFLOW_STORE, FixflowStore, StoreSnapshot } from './fixflow-store.interface';
import { buildSeedSnapshot } from '../seed/seed-data';

/**
 * Loads the seed snapshot into whatever store is bound to FIXFLOW_STORE when the app starts.
 * The snapshot comes from SEED_FILE (written by `npm run seed`). If that file does not exist the
 * same snapshot is built in memory, so the app always starts with the documented demo data.
 * Because the store is in memory, every restart resets all data to this snapshot.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    @Inject(FIXFLOW_STORE) private readonly store: FixflowStore,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const snapshot = await this.loadSnapshot();
    await this.store.reset(snapshot);
    this.logger.log(
      `Loaded ${snapshot.users.length} users, ${snapshot.categories.length} categories, ${snapshot.requests.length} requests into the "${this.store.driver}" store`,
    );
  }

  async loadSnapshot(): Promise<StoreSnapshot> {
    const file = this.config.get<string>('SEED_FILE');
    if (file && existsSync(resolve(file))) {
      return JSON.parse(readFileSync(resolve(file), 'utf8')) as StoreSnapshot;
    }
    this.logger.warn(`${file || 'SEED_FILE'} not found: building the seed in memory (run "npm run seed" to write it)`);
    const rounds = this.config.get<number>('BCRYPT_ROUNDS') ?? 10;
    return buildSeedSnapshot((password) => hash(password, rounds));
  }
}
