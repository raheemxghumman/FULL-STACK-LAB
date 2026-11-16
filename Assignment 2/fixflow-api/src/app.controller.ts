import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';
import { FIXFLOW_STORE, FixflowStore } from './storage/fixflow-store.interface';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(@Inject(FIXFLOW_STORE) private readonly store: FixflowStore) {}

  /** Public status check. "storage" names the implementation bound to FIXFLOW_STORE. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'FixFlow API', storage: this.store.driver, time: new Date().toISOString() };
  }
}
