import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID, IsIn } from 'class-validator';
import { Page } from './Page';

export type SectionType = 'hero' | 'features' | 'testimonials' | 'cta' | 'pricing' | 'team' | 'contact' | 'content' | 'gallery' | 'custom';

export type SectionSettings = {
  layout?: string;
  backgroundColor?: string;
  textColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  marginTop?: string;
  marginBottom?: string;
  backgroundImage?: string;
  backgroundOverlay?: string;
  fullWidth?: boolean;
  containerWidth?: string;
  customClasses?: string;
  customId?: string;
  animation?: string;
  animationDelay?: string;
  parallax?: boolean;
  parallaxSpeed?: number;
  isHidden?: boolean;
};

@Entity('page_sections')
export class PageSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title: string;

  @Column({ type: 'varchar', default: 'content' })
  @IsString()
  @IsIn(['hero', 'features', 'testimonials', 'cta', 'pricing', 'team', 'contact', 'content', 'gallery', 'custom'])
  type: SectionType;

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  content: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  settings: SectionSettings;

  @Column({ type: 'integer' })
  @IsNotEmpty({ message: 'Order is required' })
  order: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', name: 'page_id' })
  @IsUUID()
  pageId: string;

  @ManyToOne(() => Page, (page) => page.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper method to get section data for the frontend
  toJSON(): any {
    const { page, ...section } = this;
    return {
      ...section,
      page: page ? { id: page.id, title: page.title, slug: page.slug } : undefined,
    };
  }

  // Helper method to get default settings based on section type
  static getDefaultSettings(type: SectionType): SectionSettings {
    const defaults: Record<SectionType, SectionSettings> = {
      hero: {
        layout: 'centered',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        paddingTop: '80px',
        paddingBottom: '80px',
        fullWidth: false,
        containerWidth: '1200px',
      },
      features: {
        layout: 'three-columns',
        backgroundColor: '#f8f9fa',
        paddingTop: '60px',
        paddingBottom: '60px',
      },
      testimonials: {
        layout: 'slider',
        backgroundColor: '#ffffff',
        paddingTop: '80px',
        paddingBottom: '80px',
      },
      cta: {
        layout: 'centered',
        backgroundColor: '#4a6cf7',
        textColor: '#ffffff',
        paddingTop: '60px',
        paddingBottom: '60px',
      },
      pricing: {
        layout: 'three-columns',
        backgroundColor: '#f8f9fa',
        paddingTop: '80px',
        paddingBottom: '80px',
      },
      team: {
        layout: 'grid',
        backgroundColor: '#ffffff',
        paddingTop: '80px',
        paddingBottom: '80px',
      },
      contact: {
        layout: 'two-columns',
        backgroundColor: '#f8f9fa',
        paddingTop: '80px',
        paddingBottom: '80px',
      },
      content: {
        layout: 'one-column',
        backgroundColor: '#ffffff',
        paddingTop: '40px',
        paddingBottom: '40px',
      },
      gallery: {
        layout: 'masonry',
        backgroundColor: '#ffffff',
        paddingTop: '60px',
        paddingBottom: '60px',
      },
      custom: {
        layout: 'one-column',
        backgroundColor: '#ffffff',
        paddingTop: '40px',
        paddingBottom: '40px',
      },
    };

    return defaults[type] || defaults.custom;
  }
}
