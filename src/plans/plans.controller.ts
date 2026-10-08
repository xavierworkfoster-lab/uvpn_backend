import { Controller, Get } from '@nestjs/common';
import { PlansService } from './plans.service';
import { ApiTags } from '@nestjs/swagger';
@Controller('plans')
@ApiTags('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}
  @Get() list() {
    return this.plans.list();
  }
}
