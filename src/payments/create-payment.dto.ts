import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid', description: 'An active plan identifier' })
  @IsUUID()
  planId!: string;
}
