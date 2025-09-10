import { IsString, IsNotEmpty, IsOptional, IsUrl, IsArray, IsObject, IsUUID, IsIn, IsBoolean, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type SiteStatus = 'draft' | 'published' | 'archived';
export type SiteTemplate = 'business' | 'portfolio' | 'ecommerce' | 'blog' | 'landing' | 'custom';

export class SeoDto {
  @IsString()
  @IsOptional()
  @MaxLength(60, { message: 'SEO title cannot be longer than 60 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160, { message: 'Meta description cannot be longer than 160 characters' })
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @IsUrl()
  @IsOptional()
  image?: string;
}

export class CustomCodeDto {
  @IsString()
  @IsOptional()
  head?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  css?: string;
}

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot be longer than 100 characters' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description cannot be longer than 500 characters' })
  description?: string;

  @IsString()
  @IsIn(['business', 'portfolio', 'ecommerce', 'blog', 'landing', 'custom'])
  template: SiteTemplate = 'business';

  @IsString()
  @IsOptional()
  @IsUrl()
  favicon?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  fontFamily?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomCodeDto)
  customCode?: CustomCodeDto;
}

export class UpdateSiteDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Name cannot be longer than 100 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description cannot be longer than 500 characters' })
  description?: string;

  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  status?: SiteStatus;

  @IsString()
  @IsIn(['business', 'portfolio', 'ecommerce', 'blog', 'landing', 'custom'])
  @IsOptional()
  template?: SiteTemplate;

  @IsString()
  @IsOptional()
  @IsUrl()
  favicon?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  fontFamily?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomCodeDto)
  customCode?: CustomCodeDto;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

export class PublishSiteDto {
  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  status: 'draft' | 'published' | 'archived';

  @IsString()
  @IsOptional()
  customDomain?: string;
}

export class DuplicateSiteDto {
  @IsString()
  @IsNotEmpty({ message: 'New site name is required' })
  @MaxLength(100, { message: 'Name cannot be longer than 100 characters' })
  name: string;

  @IsBoolean()
  @IsOptional()
  duplicateContent: boolean = true;
}

export class TransferSiteOwnershipDto {
  @IsUUID()
  @IsNotEmpty({ message: 'New owner user ID is required' })
  newOwnerId: string;
}

export class SiteStatsDto {
  @IsInt()
  @Min(0)
  pageViews: number;

  @IsInt()
  @Min(0)
  visitors: number;

  @IsInt()
  @Min(0)
  formSubmissions: number;

  @IsObject()
  @IsOptional()
  topPages?: Array<{ url: string; views: number }>;

  @IsObject()
  @IsOptional()
  trafficSources?: Record<string, number>;
}

export class SiteAnalyticsQueryDto {
  @IsString()
  @IsIn(['day', 'week', 'month', 'year'])
  period: 'day' | 'week' | 'month' | 'year' = 'week';

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

export class SiteListQueryDto {
  @IsString()
  @IsIn(['all', 'published', 'draft', 'archived'])
  @IsOptional()
  status?: 'all' | 'published' | 'draft' | 'archived' = 'all';

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'name'])
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'name' = 'updatedAt';

  @IsString()
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}
