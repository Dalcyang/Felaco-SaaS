import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, IsUUID, IsIn, IsBoolean } from 'class-validator';
import { Site } from './Site';
import { PageSection } from './PageSection';

export type PageStatus = 'draft' | 'published' | 'archived';
export type PageType = 'page' | 'home' | 'about' | 'contact' | 'blog' | 'custom';

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200, { message: 'Title cannot be longer than 200 characters' })
  title: string;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @MaxLength(200, { message: 'Slug cannot be longer than 200 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  content?: string;

  @Column({ default: 'draft' })
  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  status: PageStatus;

  @Column({ type: 'varchar', default: 'page' })
  @IsString()
  @IsIn(['page', 'home', 'about', 'contact', 'blog', 'custom'])
  pageType: PageType;

  @Column({ default: false })
  @IsBoolean()
  isHomepage: boolean;

  @Column({ type: 'integer', default: 0 })
  @IsOptional()
  order: number;

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
    noIndex?: boolean;
    noFollow?: boolean;
    canonicalUrl?: string;
  };

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  settings: {
    showInNavigation?: boolean;
    navigationLabel?: string;
    template?: string;
    customCss?: string;
    customJs?: string;
    isPasswordProtected?: boolean;
    password?: string;
    redirectUrl?: string;
  };

  @Column({ type: 'uuid', name: 'site_id' })
  @IsUUID()
  siteId: string;

  @ManyToOne(() => Site, (site) => site.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @OneToMany(() => PageSection, (section) => section.page, { cascade: true })
  sections: PageSection[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper method to get the page URL
  getUrl(): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const siteSlug = this.site?.slug || '';
    return `${baseUrl}/sites/${siteSlug}/${this.slug}`;
  }

  // Helper method to get the preview URL
  getPreviewUrl(): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/preview/pages/${this.id}`;
  }

  // Helper method to get the editor URL
  getEditorUrl(): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/editor/pages/${this.id}`;
  }

  // Convert to JSON, excluding sensitive data
  toJSON(): any {
    const { site, ...page } = this;
    return {
      ...page,
      url: this.getUrl(),
      previewUrl: this.getPreviewUrl(),
      editorUrl: this.getEditorUrl(),
      site: site ? { id: site.id, name: site.name, slug: site.slug } : undefined,
    };
  }
}
