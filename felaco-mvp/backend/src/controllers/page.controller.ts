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
import { getRepository, In, Like, Not } from 'typeorm';
import { Page } from '../entity/Page';
import { Site } from '../entity/Site';
import { User } from '../entity/User';
import { 
  CreatePageDto, 
  UpdatePageDto, 
  DuplicatePageDto, 
  ReorderPagesDto,
  PageListQueryDto
} from '../dto/page.dto';
import { validate } from 'class-validator';
import { logger } from '../common/logger';
import { ApiResponse } from '../common/api.response';

@JsonController('/pages')
@Authorized()
export class PageController {
  private pageRepository = getRepository(Page);
  private siteRepository = getRepository(Site);
  private userRepository = getRepository(User);

  /**
   * Get all pages for a site
   */
  @Get()
  async listPages(
    @QueryParams() query: PageListQueryDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ pages: Page[]; total: number }>> {
    const {
      status = 'all',
      search = '',
      pageType,
      siteId,
      page = 1,
      limit = 10,
      sortBy = 'order',
      order = 'ASC',
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    // Filter by site
    if (siteId) {
      // Verify user has access to this site
      const site = await this.siteRepository.findOne({
        where: { id: siteId, owner: user },
      });

      if (!site) {
        throw new NotFoundError('Site not found or access denied');
      }
      
      where.site = site;
    } else {
      // If no site ID provided, get all sites owned by user
      const userSites = await this.siteRepository.find({
        where: { owner: user },
        select: ['id'],
      });
      
      if (userSites.length === 0) {
        return {
          success: true,
          data: { pages: [], total: 0 },
        };
      }
      
      where.site = In(userSites.map(site => site.id));
    }

    // Apply status filter
    if (status !== 'all') {
      where.status = status;
    }

    // Apply page type filter
    if (pageType) {
      where.pageType = pageType;
    }

    // Apply search filter
    if (search) {
      where.title = Like(`%${search}%`);
    }

    // Build order clause
    const orderClause: any = {};
    orderClause[sortBy] = order.toUpperCase();

    // If ordering by order, add a secondary sort by title
    if (sortBy === 'order') {
      orderClause.title = 'ASC';
    }

    // Get pages with pagination
    const [pages, total] = await this.pageRepository.findAndCount({
      where,
      order: orderClause,
      relations: ['site'],
      skip,
      take: limit,
    });

    return {
      success: true,
      data: {
        pages,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single page by ID
   */
  @Get('/:id')
  @OnUndefined(NotFoundError)
  async getPage(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Page>> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['site', 'sections'],
    });

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    // Verify user has access to the site this page belongs to
    const site = await this.siteRepository.findOne({
      where: { id: page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to access this page');
    }

    return {
      success: true,
      data: page,
    };
  }

  /**
   * Create a new page
   */
  @Post()
  @HttpCode(201)
  async createPage(
    @Body() createPageDto: CreatePageDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Page>> {
    // Validate DTO
    const errors = await validate(createPageDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    // Verify site exists and user has access
    const site = await this.siteRepository.findOne({
      where: { id: createPageDto.siteId, owner: user },
    });

    if (!site) {
      throw new NotFoundError('Site not found or access denied');
    }

    // Check if user has reached page limit for this site (if any)
    const pageCount = await this.pageRepository.count({ site });
    const maxPages = user.plan?.maxPagesPerSite || 50; // Default to 50 pages per site if no plan
    
    if (pageCount >= maxPages) {
      throw new ForbiddenError(`You have reached the maximum number of pages (${maxPages}) for this site`);
    }

    // Create new page
    const page = new Page();
    page.title = createPageDto.title;
    page.description = createPageDto.description || '';
    page.content = createPageDto.content || '';
    page.pageType = createPageDto.pageType || 'page';
    page.isHomepage = createPageDto.isHomepage || false;
    page.order = createPageDto.order || 0;
    page.status = 'draft';
    page.site = site;

    // Generate slug from title
    page.slug = this.generateSlug(createPageDto.title);

    // Check if slug is already taken in this site
    const slugExists = await this.pageRepository.findOne({ 
      where: { 
        slug: page.slug,
        site: site.id,
      } 
    });
    
    if (slugExists) {
      // Append a random string to make it unique
      page.slug = `${page.slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // If this is set as homepage, unset any existing homepage
    if (page.isHomepage) {
      await this.pageRepository.update(
        { site: site.id, isHomepage: true },
        { isHomepage: false }
      );
    }

    // Save page
    await this.pageRepository.save(page);

    logger.info(`New page created: ${page.id} for site ${site.id} by user ${user.id}`);

    return {
      success: true,
      data: page,
      message: 'Page created successfully',
    };
  }

  /**
   * Update a page
   */
  @Put('/:id')
  async updatePage(
    @Param('id') id: string,
    @Body() updatePageDto: UpdatePageDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Page>> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['site'],
    });

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    // Verify user has access to the site this page belongs to
    const site = await this.siteRepository.findOne({
      where: { id: page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to update this page');
    }

    // Update page properties
    if (updatePageDto.title !== undefined) {
      page.title = updatePageDto.title;
      
      // Update slug if title changes
      if (updatePageDto.title !== page.title) {
        page.slug = this.generateSlug(updatePageDto.title);
        
        // Check if new slug is already taken in this site
        const slugExists = await this.pageRepository.findOne({ 
          where: { 
            slug: page.slug,
            site: site.id,
            id: Not(id) // Exclude current page
          } 
        });
        
        if (slugExists) {
          // Append a random string to make it unique
          page.slug = `${page.slug}-${Math.random().toString(36).substring(2, 6)}`;
        }
      }
    }

    if (updatePageDto.description !== undefined) {
      page.description = updatePageDto.description;
    }

    if (updatePageDto.content !== undefined) {
      page.content = updatePageDto.content;
    }

    if (updatePageDto.status) {
      page.status = updatePageDto.status as any;
    }

    if (updatePageDto.pageType) {
      page.pageType = updatePageDto.pageType as any;
    }

    if (updatePageDto.isHomepage !== undefined) {
      // If setting this page as homepage, unset any existing homepage
      if (updatePageDto.isHomepage) {
        await this.pageRepository.update(
          { site: site.id, isHomepage: true, id: Not(id) },
          { isHomepage: false }
        );
      }
      page.isHomepage = updatePageDto.isHomepage;
    }

    if (updatePageDto.order !== undefined) {
      page.order = updatePageDto.order;
    }

    // Update SEO settings
    if (updatePageDto.seo) {
      page.seo = {
        ...(page.seo || {}),
        ...updatePageDto.seo,
      };
    }

    // Update page settings
    if (updatePageDto.settings) {
      page.settings = {
        ...(page.settings || {}),
        ...updatePageDto.settings,
      };
    }

    // Save changes
    await this.pageRepository.save(page);

    return {
      success: true,
      data: page,
      message: 'Page updated successfully',
    };
  }

  /**
   * Duplicate a page
   */
  @Post('/:id/duplicate')
  async duplicatePage(
    @Param('id') id: string,
    @Body() duplicatePageDto: DuplicatePageDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<Page>> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['site', 'sections'],
    });

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    // Verify user has access to the site this page belongs to
    const site = await this.siteRepository.findOne({
      where: { id: page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to duplicate this page');
    }

    // Check if user has reached page limit for this site (if any)
    const pageCount = await this.pageRepository.count({ site });
    const maxPages = user.plan?.maxPagesPerSite || 50; // Default to 50 pages per site if no plan
    
    if (pageCount >= maxPages) {
      throw new ForbiddenError(`You have reached the maximum number of pages (${maxPages}) for this site`);
    }

    // Create a deep copy of the page
    const newPage = new Page();
    Object.assign(newPage, page);
    
    // Reset ID and timestamps
    newPage.id = undefined;
    newPage.createdAt = undefined;
    newPage.updatedAt = undefined;
    newPage.publishedAt = undefined;
    
    // Update title and slug
    newPage.title = duplicatePageDto.title;
    newPage.slug = this.generateSlug(duplicatePageDto.title);
    newPage.status = 'draft';
    newPage.isHomepage = false; // Don't allow duplicating homepage status

    // Check if slug is already taken in this site
    const slugExists = await this.pageRepository.findOne({ 
      where: { 
        slug: newPage.slug,
        site: site.id,
      } 
    });
    
    if (slugExists) {
      // Append a random string to make it unique
      newPage.slug = `${newPage.slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // Save the new page
    await this.pageRepository.save(newPage);

    // Duplicate sections if any and requested
    if (duplicatePageDto.duplicateContent && page.sections && page.sections.length > 0) {
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

    logger.info(`Page ${page.id} duplicated to ${newPage.id} by user ${user.id}`);

    return {
      success: true,
      data: newPage,
      message: 'Page duplicated successfully',
    };
  }

  /**
   * Reorder pages
   */
  @Post('/reorder')
  async reorderPages(
    @Body() reorderDto: ReorderPagesDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ success: boolean }>> {
    if (!reorderDto.pageIds || reorderDto.pageIds.length === 0) {
      throw new BadRequestError('No page IDs provided');
    }

    // Get all pages to reorder
    const pages = await this.pageRepository.find({
      where: { id: In(reorderDto.pageIds) },
      relations: ['site'],
    });

    if (pages.length !== reorderDto.pageIds.length) {
      throw new BadRequestError('One or more pages not found');
    }

    // Verify user has access to all pages
    for (const page of pages) {
      const site = await this.siteRepository.findOne({
        where: { id: page.site.id, owner: user },
      });

      if (!site) {
        throw new ForbiddenError(`You do not have permission to reorder page ${page.id}`);
      }
    }

    // Update order of each page
    const updatePromises = reorderDto.pageIds.map((pageId, index) => {
      return this.pageRepository.update(pageId, { order: index });
    });

    await Promise.all(updatePromises);

    logger.info(`Pages reordered by user ${user.id}`);

    return {
      success: true,
      data: { success: true },
      message: 'Pages reordered successfully',
    };
  }

  /**
   * Delete a page
   */
  @Delete('/:id')
  @HttpCode(204)
  @OnUndefined(204)
  async deletePage(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<void> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['site'],
    });

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    // Verify user has access to the site this page belongs to
    const site = await this.siteRepository.findOne({
      where: { id: page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to delete this page');
    }

    // Prevent deleting the last page of a site
    const pageCount = await this.pageRepository.count({ site: site.id });
    if (pageCount <= 1) {
      throw new BadRequestError('Cannot delete the last page of a site');
    }

    // If this is the homepage, set another page as homepage
    if (page.isHomepage) {
      // Find another page to set as homepage
      const anotherPage = await this.pageRepository.findOne({
        where: { site: site.id, id: Not(id) },
      });

      if (anotherPage) {
        anotherPage.isHomepage = true;
        await this.pageRepository.save(anotherPage);
      }
    }

    // Soft delete the page
    await this.pageRepository.softRemove(page);

    logger.info(`Page ${page.id} deleted by user ${user.id}`);
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
