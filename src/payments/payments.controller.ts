import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreatePaymentDto } from './create-payment.dto';
import { PaymentsService } from './payments.service';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post()
  @ApiBody({ type: CreatePaymentDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user.id, dto.planId);
  }
  @Get('history') history(@CurrentUser() user: AuthUser) {
    return this.payments.history(user.id);
  }
  @Get(':id') get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.get(user.id, id);
  }
}
