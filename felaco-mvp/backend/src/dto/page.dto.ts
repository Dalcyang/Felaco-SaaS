import { IsString, IsNotEmpty, IsOptional, IsUrl, IsArray, IsObject, IsUUID, IsIn, IsBoolean, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type PageStatus = 'draft' | 'published' | 'archived';
export type PageType = 'page' | 'home' | 'about' | 'contact' | 'blog' | 'custom';

export class PageSeoDto {
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

  @IsBoolean()
  @IsOptional()
  noIndex?: boolean;

  @IsBoolean()
  @IsOptional()
  noFollow?: boolean;

  @IsUrl()
  @IsOptional()
  canonicalUrl?: string;
}

export class PageSettingsDto {
  @IsBoolean()
  @IsOptional()
  showInNavigation?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Navigation label cannot be longer than 50 characters' })
  navigationLabel?: string;

  @IsString()
  @IsOptional()
  template?: string;

  @IsString()
  @IsOptional()
  customCss?: string;

  @IsString()
  @IsOptional()
  customJs?: string;

  @IsBoolean()
  @IsOptional()
  isPasswordProtected?: boolean;

  @IsString()
  @IsOptional()
  password?: string;

  @IsUrl()
  @IsOptional()
  redirectUrl?: string;
}

export class CreatePageDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description cannot be longer than 500 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000, { message: 'Content is too long' })
  content?: string;

  @IsString()
  @IsIn(['page', 'home', 'about', 'contact', 'blog', 'custom'])
  @IsOptional()
  pageType: PageType = 'page';

  @IsBoolean()
  @IsOptional()
  isHomepage: boolean = false;

  @IsInt()
  @Min(0)
  @IsOptional()
  order: number = 0;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PageSeoDto)
  seo?: PageSeoDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PageSettingsDto)
  settings?: PageSettingsDto;

  @IsUUID()
  @IsNotEmpty({ message: 'Site ID is required' })
  siteId: string;
}

export class UpdatePageDto {
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description cannot be longer than 500 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000, { message: 'Content is too long' })
  content?: string;

  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  status?: PageStatus;

  @IsString()
  @IsIn(['page', 'home', 'about', 'contact', 'blog', 'custom'])
  @IsOptional()
  pageType?: PageType;

  @IsBoolean()
  @IsOptional()
  isHomepage?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PageSeoDto)
  seo?: PageSeoDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PageSettingsDto)
  settings?: PageSettingsDto;
}

export class DuplicatePageDto {
  @IsString()
  @IsNotEmpty({ message: 'New page title is required' })
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Slug is too long' })
  slug?: string;

  @IsBoolean()
  @IsOptional()
  duplicateContent: boolean = true;
}

export class ReorderPagesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty({ each: true })
  pageIds: string[];
}

export class PageListQueryDto {
  @IsString()
  @IsIn(['all', 'published', 'draft', 'archived'])
  @IsOptional()
  status?: 'all' | 'published' | 'draft' | 'archived' = 'all';

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsIn(['page', 'home', 'about', 'contact', 'blog', 'custom'])
  @IsOptional()
  pageType?: PageType;

  @IsUUID()
  @IsOptional()
  siteId?: string;

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
  @IsIn(['createdAt', 'updatedAt', 'title', 'order'])
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'order' = 'order';

  @IsString()
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'ASC';
}
