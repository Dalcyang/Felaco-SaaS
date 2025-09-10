import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID, IsIn, IsBoolean, IsArray, ValidateNested, Type } from 'class-validator';

export type SectionType = 'hero' | 'features' | 'testimonials' | 'cta' | 'pricing' | 'team' | 'contact' | 'content' | 'gallery' | 'custom';

export class SectionSettingsDto {
  @IsString()
  @IsOptional()
  layout?: string;

  @IsString()
  @IsOptional()
  backgroundColor?: string;

  @IsString()
  @IsOptional()
  textColor?: string;

  @IsString()
  @IsOptional()
  paddingTop?: string;

  @IsString()
  @IsOptional()
  paddingBottom?: string;

  @IsString()
  @IsOptional()
  marginTop?: string;

  @IsString()
  @IsOptional()
  marginBottom?: string;

  @IsString()
  @IsOptional()
  backgroundImage?: string;

  @IsString()
  @IsOptional()
  backgroundOverlay?: string;

  @IsBoolean()
  @IsOptional()
  fullWidth?: boolean;

  @IsString()
  @IsOptional()
  containerWidth?: string;

  @IsString()
  @IsOptional()
  customClasses?: string;

  @IsString()
  @IsOptional()
  customId?: string;

  @IsString()
  @IsOptional()
  animation?: string;

  @IsString()
  @IsOptional()
  animationDelay?: string;

  @IsBoolean()
  @IsOptional()
  parallax?: boolean;

  @IsOptional()
  parallaxSpeed?: number;

  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title: string;

  @IsString()
  @IsIn(['hero', 'features', 'testimonials', 'cta', 'pricing', 'team', 'contact', 'content', 'gallery', 'custom'])
  @IsOptional()
  type: SectionType = 'content';

  @IsObject()
  @IsOptional()
  content?: Record<string, any>;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionSettingsDto)
  settings?: SectionSettingsDto;

  @IsInt()
  @IsNotEmpty({ message: 'Order is required' })
  order: number;

  @IsBoolean()
  @IsOptional()
  isActive: boolean = true;

  @IsUUID()
  @IsNotEmpty({ message: 'Page ID is required' })
  pageId: string;
}

export class UpdateSectionDto {
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title?: string;

  @IsString()
  @IsIn(['hero', 'features', 'testimonials', 'cta', 'pricing', 'team', 'contact', 'content', 'gallery', 'custom'])
  @IsOptional()
  type?: SectionType;

  @IsObject()
  @IsOptional()
  content?: Record<string, any>;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionSettingsDto)
  settings?: SectionSettingsDto;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ReorderSectionsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty({ each: true })
  sectionIds: string[];
}

export class SectionListQueryDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Page ID is required' })
  pageId: string;

  @IsBoolean()
  @IsOptional()
  activeOnly: boolean = true;

  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'title', 'order'])
  @IsOptional()
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'order' = 'order';

  @IsString()
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  order: 'ASC' | 'DESC' = 'ASC';
}
