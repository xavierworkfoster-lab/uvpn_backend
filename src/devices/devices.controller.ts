import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateDeviceDto } from './device.dto';
import { DevicesService } from './devices.service';

@Controller('account/devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @ApiBody({ type: CreateDeviceDto })
  register(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.devices.register(user.id, dto);
  }

  @Delete(':id')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devices.revoke(user.id, id);
  }
}
