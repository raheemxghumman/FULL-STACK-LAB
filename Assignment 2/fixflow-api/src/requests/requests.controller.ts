import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { NonEmptyBodyPipe, ParsePositiveIntPipe } from '../common/pipes';
import { traceStage } from '../common/request-context';
import {
  AssignRequestDto, CreateRequestDto, FeedbackDto, ListRequestsQueryDto, ReopenRequestDto, ResolveRequestDto, UpdateRequestDto,
} from './dto/request.dto';
import { RequestsService } from './requests.service';

/**
 * HTTP layer only: routes, roles, pipes and status codes. Every rule lives in RequestsService.
 * Status changes use dedicated action endpoints; they answer 200 (POST defaults to 201 otherwise).
 */
@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  /** Create a request (requester). 201. */
  @Post()
  @Roles(Role.REQUESTER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.requests.create(user, dto);
  }

  /** Search, filter and paginate the caller's scoped requests. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListRequestsQueryDto) {
    return this.requests.list(user, query);
  }

  /** Request, current assignment, assignment history, chronological status history and feedback. */
  @Get(':id')
  details(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number) {
    return this.requests.details(user, id);
  }

  /**
   * Edit own OPEN request (requester). This is the instrumented route: with LIFECYCLE_TRACE=true
   * every stage it passes through is logged (see docs/architecture-and-lifecycle.md).
   */
  @Patch(':id')
  @Roles(Role.REQUESTER)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body(NonEmptyBodyPipe) dto: UpdateRequestDto,
  ) {
    traceStage('5 controller', `RequestsController.update(#${id}) -> calling RequestsService`);
    return this.requests.update(user, id, dto);
  }

  /** Cancel own OPEN request (requester). */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.REQUESTER)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number) {
    return this.requests.cancel(user, id);
  }

  /** Assign an OPEN request to an eligible technician (dispatcher). */
  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.DISPATCHER)
  assign(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number, @Body() dto: AssignRequestDto) {
    return this.requests.assign(user, id, dto);
  }

  /** Start assigned work (assigned technician). */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TECHNICIAN)
  start(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number) {
    return this.requests.start(user, id);
  }

  /** Complete work with a resolution note (assigned technician). */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TECHNICIAN)
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number, @Body() dto: ResolveRequestDto) {
    return this.requests.resolve(user, id, dto);
  }

  /** Confirm completion of own RESOLVED request (requester). */
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.REQUESTER)
  close(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number) {
    return this.requests.close(user, id);
  }

  /** Reopen own RESOLVED request with a reason (requester). Clears the assignment. */
  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.REQUESTER)
  reopen(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number, @Body() dto: ReopenRequestDto) {
    return this.requests.reopen(user, id, dto);
  }

  /** Submit one feedback record for own CLOSED request (requester). 201. */
  @Post(':id/feedback')
  @Roles(Role.REQUESTER)
  feedback(@CurrentUser() user: AuthUser, @Param('id', ParsePositiveIntPipe) id: number, @Body() dto: FeedbackDto) {
    return this.requests.submitFeedback(user, id, dto);
  }
}
