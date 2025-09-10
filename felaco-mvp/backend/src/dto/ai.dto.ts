import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, IsIn, IsInt, Min, Max, IsBoolean } from 'class-validator';

export type AIContentType = 'text' | 'image' | 'code' | 'seo' | 'cta' | 'headline' | 'paragraph' | 'testimonial' | 'faq' | 'pricing' | 'team' | 'feature' | 'blog' | 'product' | 'custom';

export class AIGenerateContentDto {
  @IsString()
  @IsNotEmpty({ message: 'Prompt is required' })
  @MaxLength(2000, { message: 'Prompt cannot be longer than 2000 characters' })
  prompt: string;

  @IsString()
  @IsIn(['text', 'image', 'code', 'seo', 'cta', 'headline', 'paragraph', 'testimonial', 'faq', 'pricing', 'team', 'feature', 'blog', 'product', 'custom'])
  @IsOptional()
  type: AIContentType = 'text';

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  variations: number = 1;

  @IsInt()
  @Min(1)
  @Max(2000)
  @IsOptional()
  maxLength: number = 500;

  @IsString()
  @IsOptional()
  tone?: string;

  @IsString()
  @IsOptional()
  style?: string;

  @IsString()
  @IsOptional()
  language?: string = 'en';

  @IsObject()
  @IsOptional()
  context?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  includeKeywords: boolean = true;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  callToAction?: string;
}

export class AIGenerateImageDto {
  @IsString()
  @IsNotEmpty({ message: 'Prompt is required' })
  @MaxLength(1000, { message: 'Prompt cannot be longer than 1000 characters' })
  prompt: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  n: number = 1;

  @IsString()
  @IsIn(['256x256', '512x512', '1024x1024'])
  @IsOptional()
  size: '256x256' | '512x512' | '1024x1024' = '512x512';

  @IsString()
  @IsOptional()
  style?: 'vivid' | 'natural' = 'vivid';

  @IsString()
  @IsOptional()
  artistStyle?: string;

  @IsString()
  @IsOptional()
  colorScheme?: string;

  @IsBoolean()
  @IsOptional()
  transparent: boolean = false;
}

export class AIEnhanceContentDto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @IsString()
  @IsIn(['improve', 'shorten', 'lengthen', 'simplify', 'professional', 'casual', 'friendly', 'formal', 'creative', 'persuasive'])
  @IsOptional()
  action: 'improve' | 'shorten' | 'lengthen' | 'simplify' | 'professional' | 'casual' | 'friendly' | 'formal' | 'creative' | 'persuasive' = 'improve';

  @IsString()
  @IsOptional()
  tone?: string;

  @IsString()
  @IsOptional()
  style?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  variations: number = 1;
}

export class AITranslateContentDto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @IsString()
  @IsNotEmpty({ message: 'Target language is required' })
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;

  @IsBoolean()
  @IsOptional()
  formal: boolean = false;
}

export class AIAnalyzeSEODto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];
}

export class AIGenerateResponseDto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @IsString()
  @IsIn(['reply', 'followup', 'thankyou', 'apology', 'confirmation', 'rejection', 'clarification', 'custom'])
  @IsOptional()
  type: 'reply' | 'followup' | 'thankyou' | 'apology' | 'confirmation' | 'rejection' | 'clarification' | 'custom' = 'reply';

  @IsString()
  @IsOptional()
  tone?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  variations: number = 1;

  @IsInt()
  @Min(1)
  @Max(2000)
  @IsOptional()
  maxLength: number = 500;
}

export class AIContentResponseDto {
  id: string;
  type: string;
  content: string | string[];
  metadata: {
    model: string;
    tokens: number;
    credits: number;
    timestamp: Date;
    parameters: Record<string, any>;
  };
}

export class AICreditsDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty({ message: 'Amount is required' })
  amount: number;

  @IsString()
  @IsIn(['purchase', 'bonus', 'refund', 'adjustment'])
  @IsOptional()
  type: 'purchase' | 'bonus' | 'refund' | 'adjustment' = 'purchase';

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  referenceId?: string;
}

export class AICreditsHistoryQueryDto {
  @IsString()
  @IsIn(['all', 'purchase', 'usage', 'bonus', 'refund', 'adjustment'])
  @IsOptional()
  type?: 'all' | 'purchase' | 'usage' | 'bonus' | 'refund' | 'adjustment' = 'all';

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
  @IsIn(['date', 'amount', 'type'])
  @IsOptional()
  sortBy?: 'date' | 'amount' | 'type' = 'date';

  @IsString()
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}
