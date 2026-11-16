import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { ReportsService } from './reports.service';

@ApiTags('Dashboard & reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Role-specific summary: requester counts, technician workload, or the dispatcher's system view. */
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  /** Operational report: workload, resolved jobs, feedback count and average rating per technician (dispatcher). */
  @Get('reports/technicians')
  @Roles(Role.DISPATCHER)
  technicians() {
    return this.reports.technicianReport();
  }
}
