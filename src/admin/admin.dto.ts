import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  @ApiProperty({ minimum: 0, type: Number })
  @IsNumber()
  @Min(0)
  priceUsd!: number;
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  durationDays!: number;
  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  maxDevices!: number;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional({ minimum: 0, type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  maxDevices?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateServerDto {
  @ApiProperty()
  @IsString()
  name!: string;
  @ApiProperty()
  @IsString()
  country!: string;
  @ApiProperty()
  @IsString()
  city!: string;
  @ApiProperty()
  @IsString()
  hostname!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;
  @ApiProperty({ example: 'OPENVPN' })
  @IsString()
  protocol!: string;
  @ApiProperty({ minimum: 1, maximum: 65535 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  maxUsers!: number;
}

export class UpdateServerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostname?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  protocol?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 65535 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;
  @ApiPropertyOptional({ enum: ['ONLINE', 'OFFLINE', 'MAINTENANCE'] })
  @IsOptional()
  @IsEnum(['ONLINE', 'OFFLINE', 'MAINTENANCE'])
  status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
}

export class UserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] })
  @IsEnum(['ACTIVE', 'SUSPENDED', 'DELETED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}
