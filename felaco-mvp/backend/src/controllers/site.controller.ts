import {
  JsonController,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  QueryParams,
  CurrentUser,
  Authorized,
  HttpCode,
  OnUndefined,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import { getRepository, In, Like } from 'typeorm';
import { Site } from '../entity/Site';
import { User } from '../entity/User';
import { Page } from '../entity/Page';
import { 
  CreateSiteDto, 
  UpdateSiteDto, 
  PublishSiteDto, 
  DuplicateSiteDto, 
  TransferSiteOwnershipDto,
  SiteListQueryDto,
  SiteStatsDto,
  SiteAnalyticsQueryDto
} from '../dto/site.dto';
import { validate } from 'class-validator';
import { logger } from '../common/logger';
import { ApiResponse } from '../common/api.response';

@JsonController('/sites')
@Authorized()
export class SiteController {
  private siteRepository = getRepository(Site);
  private pageRepository = getRepository(Page);
  private userRepository = getRepository(User);

  /**
   * Get all sites for the current user
   */
  @Get()
  async listSites(
    @CurrentUser() user: User,
    @QueryParams() query: SiteListQueryDto
  ): Promise<ApiResponse<{ sites: Site[]; total: number }>> {
    const {
      status = 'all',
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'updatedAt',
      order = 'DESC',
    } = query;

    const skip = (page - 1) * limit;
    const where: any = { owner: user };

    // Apply status filter
    if (status !== 'all') {
      where.status = status;
    }

    // Apply search filter
    if (search) {
      where.name = Like(`%${search}%`);
    }

    // Build order clause
    const orderClause: any = {};
    orderClause[sortBy] = order.toUpperCase();

    // Get sites with pagination
    const [sites, total] = await this.siteRepository.findAndCount({
      where,
      order: orderClause,
      skip,
      take: limit,
      relations: ['pages'],
    });

    return {
      success: true,
      data: {
        sites,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single site by ID
   */
  @Get('/:id')
  @OnUndefined(NotFoundError)
  async getSite(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Site>> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
      relations: ['pages', 'pages.sections'],
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    return {
      success: true,
      data: site,
    };
  }

  /**
   * Create a new site
   */
  @Post()
  @HttpCode(201)
  async createSite(
    @Body() createSiteDto: CreateSiteDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Site>> {
    // Validate DTO
    const errors = await validate(createSiteDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    // Check if user has reached site limit (if any)
    const userSiteCount = await this.siteRepository.count({ owner: user });
    const maxSites = user.plan?.maxSites || 10; // Default to 10 sites if no plan
    
    if (userSiteCount >= maxSites) {
      throw new ForbiddenError(`You have reached the maximum number of sites (${maxSites}) for your plan`);
    }

    // Create new site
    const site = new Site();
    site.name = createSiteDto.name;
    site.description = createSiteDto.description || '';
    site.template = createSiteDto.template || 'business';
    site.owner = user;
    site.status = 'draft';

    // Generate slug from name
    site.slug = this.generateSlug(createSiteDto.name);

    // Check if slug is already taken
    const slugExists = await this.siteRepository.findOne({ where: { slug: site.slug } });
    if (slugExists) {
      // Append a random string to make it unique
      site.slug = `${site.slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Save site
    await this.siteRepository.save(site);

    // Create a default home page
    const homePage = new Page();
    homePage.title = 'Home';
    homePage.slug = 'home';
    homePage.pageType = 'home';
    homePage.isHomepage = true;
    homePage.site = site;
    homePage.status = 'draft';
    homePage.order = 0;

    await this.pageRepository.save(homePage);

    logger.info(`New site created: ${site.id} by user ${user.id}`);

    return {
      success: true,
      data: site,
      message: 'Site created successfully',
    };
  }

  /**
   * Update a site
   */
  @Put('/:id')
  async updateSite(
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Site>> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    // Update site properties
    if (updateSiteDto.name !== undefined) {
      site.name = updateSiteDto.name;
      
      // Update slug if name changes
      if (updateSiteDto.name !== site.name) {
        site.slug = this.generateSlug(updateSiteDto.name);
        
        // Check if new slug is already taken
        const slugExists = await this.siteRepository.findOne({ 
          where: { 
            slug: site.slug,
            id: Not(id) // Exclude current site
          } 
        });
        
        if (slugExists) {
          // Append a random string to make it unique
          site.slug = `${site.slug}-${Math.random().toString(36).substring(2, 8)}`;
        }
      }
    }

    if (updateSiteDto.description !== undefined) {
      site.description = updateSiteDto.description;
    }

    if (updateSiteDto.status) {
      site.status = updateSiteDto.status as any;
    }

    if (updateSiteDto.template) {
      site.template = updateSiteDto.template as any;
    }

    // Update colors and design
    if (updateSiteDto.primaryColor) {
      site.primaryColor = updateSiteDto.primaryColor;
    }

    if (updateSiteDto.secondaryColor) {
      site.secondaryColor = updateSiteDto.secondaryColor;
    }

    if (updateSiteDto.fontFamily) {
      site.fontFamily = updateSiteDto.fontFamily;
    }

    // Update SEO settings
    if (updateSiteDto.seo) {
      site.seo = {
        ...(site.seo || {}),
        ...updateSiteDto.seo,
      };
    }

    // Update custom code
    if (updateSiteDto.customCode) {
      site.customCode = {
        ...(site.customCode || {}),
        ...updateSiteDto.customCode,
      };
    }

    // Save changes
    await this.siteRepository.save(site);

    return {
      success: true,
      data: site,
      message: 'Site updated successfully',
    };
  }

  /**
   * Publish a site
   */
  @Post('/:id/publish')
  async publishSite(
    @Param('id') id: string,
    @Body() publishSiteDto: PublishSiteDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Site>> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    // Update site status
    site.status = publishSiteDto.status as any;
    site.publishedAt = publishSiteDto.status === 'published' ? new Date() : null;

    // Handle custom domain if provided
    if (publishSiteDto.customDomain) {
      site.customDomain = publishSiteDto.customDomain;
      // TODO: Add domain verification logic
    }

    await this.siteRepository.save(site);

    logger.info(`Site ${site.id} published by user ${user.id} with status: ${publishSiteDto.status}`);

    return {
      success: true,
      data: site,
      message: `Site ${publishSiteDto.status} successfully`,
    };
  }

  /**
   * Duplicate a site
   */
  @Post('/:id/duplicate')
  async duplicateSite(
    @Param('id') id: string,
    @Body() duplicateSiteDto: DuplicateSiteDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Site>> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
      relations: ['pages', 'pages.sections'],
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    // Check if user has reached site limit (if any)
    const userSiteCount = await this.siteRepository.count({ owner: user });
    const maxSites = user.plan?.maxSites || 10; // Default to 10 sites if no plan
    
    if (userSiteCount >= maxSites) {
      throw new ForbiddenError(`You have reached the maximum number of sites (${maxSites}) for your plan`);
    }

    // Create a deep copy of the site
    const newSite = new Site();
    Object.assign(newSite, site);
    
    // Reset ID and timestamps
    newSite.id = undefined;
    newSite.createdAt = undefined;
    newSite.updatedAt = undefined;
    newSite.publishedAt = undefined;
    
    // Update name and slug
    newSite.name = duplicateSiteDto.name;
    newSite.slug = this.generateSlug(duplicateSiteDto.name);
    newSite.status = 'draft';

    // Check if slug is already taken
    const slugExists = await this.siteRepository.findOne({ where: { slug: newSite.slug } });
    if (slugExists) {
      // Append a random string to make it unique
      newSite.slug = `${newSite.slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Save the new site
    await this.siteRepository.save(newSite);

    // Duplicate pages if requested
    if (duplicateSiteDto.duplicateContent && site.pages) {
      for (const page of site.pages) {
        const newPage = new Page();
        Object.assign(newPage, page);
        
        // Reset ID and timestamps
        newPage.id = undefined;
        newPage.createdAt = undefined;
        newPage.updatedAt = undefined;
        newPage.site = newSite;
        
        // Update slug if it's the homepage
        if (newPage.isHomepage) {
          newPage.slug = 'home';
        }

        await this.pageRepository.save(newPage);

        // Duplicate sections if any
        if (page.sections && page.sections.length > 0) {
          for (const section of page.sections) {
            const newSection = new PageSection();
            Object.assign(newSection, section);
            
            // Reset ID and timestamps
            newSection.id = undefined;
            newSection.createdAt = undefined;
            newSection.updatedAt = undefined;
            newSection.page = newPage;
            
            await this.pageSectionRepository.save(newSection);
          }
        }
      }
    }

    logger.info(`Site ${site.id} duplicated to ${newSite.id} by user ${user.id}`);

    return {
      success: true,
      data: newSite,
      message: 'Site duplicated successfully',
    };
  }

  /**
   * Transfer site ownership
   */
  @Post('/:id/transfer-ownership')
  async transferOwnership(
    @Param('id') id: string,
    @Body() transferDto: TransferSiteOwnershipDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Site>> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    // Find the new owner
    const newOwner = await this.userRepository.findOne({
      where: { id: transferDto.newOwnerId },
    });

    if (!newOwner) {
      throw new BadRequestError('New owner not found');
    }

    // Check if the new owner is the same as the current owner
    if (newOwner.id === user.id) {
      throw new BadRequestError('You already own this site');
    }

    // Check if the new owner has reached their site limit
    const newOwnerSiteCount = await this.siteRepository.count({ owner: newOwner });
    const maxSites = newOwner.plan?.maxSites || 10; // Default to 10 sites if no plan
    
    if (newOwnerSiteCount >= maxSites) {
      throw new BadRequestError(`The new owner has reached their maximum number of sites (${maxSites})`);
    }

    // Transfer ownership
    site.owner = newOwner;
    await this.siteRepository.save(site);

    logger.info(`Site ${site.id} ownership transferred from user ${user.id} to ${newOwner.id}`);

    // TODO: Send notification to the new owner

    return {
      success: true,
      data: site,
      message: 'Site ownership transferred successfully',
    };
  }

  /**
   * Delete a site
   */
  @Delete('/:id')
  @HttpCode(204)
  @OnUndefined(204)
  async deleteSite(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<void> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    // Soft delete the site
    await this.siteRepository.softRemove(site);

    logger.info(`Site ${site.id} deleted by user ${user.id}`);
  }

  /**
   * Get site statistics
   */
  @Get('/:id/stats')
  async getSiteStats(
    @Param('id') id: string,
    @QueryParams() query: SiteAnalyticsQueryDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<SiteStatsDto>> {
    const site = await this.siteRepository.findOne({
      where: { id, owner: user },
    });

    if (!site) {
      throw new NotFoundError('Site not found');
    }

    // TODO: Implement actual analytics logic
    // This is a placeholder implementation
    const stats: SiteStatsDto = {
      pageViews: 0,
      visitors: 0,
      formSubmissions: 0,
      topPages: [],
      trafficSources: {},
    };

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Generate a URL-friendly slug from a string
   */
  private generateSlug(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}
