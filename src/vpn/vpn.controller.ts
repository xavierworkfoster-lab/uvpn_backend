import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateSessionDto } from './create-session.dto';
import { VpnService } from './vpn.service';

@Controller('vpn')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('vpn')
export class VpnController {
  constructor(private readonly vpn: VpnService) {}

  @Get('servers') servers() {
    return this.vpn.servers();
  }

  @Get('sessions') sessions(@CurrentUser() user: AuthUser) {
    return this.vpn.sessions(user.id);
  }

  @Post('sessions')
  @ApiBody({ type: CreateSessionDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.vpn.create(user.id, dto);
  }

  @Delete('sessions/:id')
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vpn.close(user.id, id);
  }
}
