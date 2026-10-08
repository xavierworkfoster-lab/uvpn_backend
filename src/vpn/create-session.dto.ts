import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serverId!: string;
}
