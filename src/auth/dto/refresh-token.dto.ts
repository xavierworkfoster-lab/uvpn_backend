import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ format: 'password', description: 'Current refresh token' })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
