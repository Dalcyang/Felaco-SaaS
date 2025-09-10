import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsUrl, IsArray, IsObject, IsUUID } from 'class-validator';
import { User } from './User';
import { Page } from './Page';

export type SiteStatus = 'draft' | 'published' | 'archived';
export type SiteTemplate = 'business' | 'portfolio' | 'ecommerce' | 'blog' | 'landing' | 'custom';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot be longer than 100 characters' })
  name: string;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @MaxLength(100, { message: 'Slug cannot be longer than 100 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Column({ default: 'draft' })
  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  status: SiteStatus;

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  settings: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
  };

  @Column({ type: 'varchar', nullable: true })
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Invalid URL format for favicon' })
  favicon?: string;

  @Column({ type: 'varchar', nullable: true })
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Invalid URL format for logo' })
  logo?: string;

  @Column({ type: 'varchar', nullable: true })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @Column({ type: 'varchar', nullable: true })
  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @Column({ type: 'varchar', nullable: true })
  @IsString()
  @IsOptional()
  fontFamily?: string;

  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  @IsOptional()
  customCode?: {
    head?: string;
    body?: string;
    css?: string;
  };

  @Column({ type: 'varchar', default: 'business' })
  @IsString()
  @IsIn(['business', 'portfolio', 'ecommerce', 'blog', 'landing', 'custom'])
  template: SiteTemplate;

  @Column({ type: 'uuid', name: 'owner_id' })
  @IsUUID()
  ownerId: string;

  @ManyToOne(() => User, (user) => user.sites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => Page, (page) => page.site, { cascade: true })
  pages: Page[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper method to get the site URL
  getUrl(): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/sites/${this.slug}`;
  }

  // Helper method to get the preview URL
  getPreviewUrl(): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/preview/${this.id}`;
  }

  // Helper method to get the editor URL
  getEditorUrl(): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/editor/${this.id}`;
  }

  // Convert to JSON, excluding sensitive data
  toJSON(): any {
    const { owner, ...site } = this;
    return {
      ...site,
      url: this.getUrl(),
      previewUrl: this.getPreviewUrl(),
      editorUrl: this.getEditorUrl(),
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : undefined,
    };
  }
}
