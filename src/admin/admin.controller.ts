import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  CreatePlanDto,
  CreateServerDto,
  UpdatePlanDto,
  UpdateServerDto,
  UserStatusDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
@ApiTags('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users') users() {
    return this.admin.users();
  }
  @Get('payments') payments() {
    return this.admin.payments();
  }
  @Get('subscriptions') subscriptions() {
    return this.admin.subscriptions();
  }
  @Post('plans') createPlan(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreatePlanDto,
  ) {
    return this.admin.createPlan(actor.id, dto);
  }
  @Patch('plans/:id') updatePlan(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.admin.updatePlan(actor.id, id, dto);
  }
  @Post('vpn/servers') createServer(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateServerDto,
  ) {
    return this.admin.createServer(actor.id, dto);
  }
  @Patch('vpn/servers/:id') updateServer(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServerDto,
  ) {
    return this.admin.updateServer(actor.id, id, dto);
  }
  @Patch('users/:id/status') setUserStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UserStatusDto,
  ) {
    return this.admin.setUserStatus(actor.id, id, dto);
  }
}
