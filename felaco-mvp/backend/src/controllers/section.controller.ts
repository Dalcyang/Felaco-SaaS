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
import { getRepository, In } from 'typeorm';
import { PageSection } from '../entity/PageSection';
import { Page } from '../entity/Page';
import { Site } from '../entity/Site';
import { User } from '../entity/User';
import { 
  CreateSectionDto, 
  UpdateSectionDto, 
  ReorderSectionsDto,
  SectionListQueryDto
} from '../dto/section.dto';
import { validate } from 'class-validator';
import { logger } from '../common/logger';
import { ApiResponse } from '../common/api.response';

@JsonController('/sections')
@Authorized()
export class SectionController {
  private sectionRepository = getRepository(PageSection);
  private pageRepository = getRepository(Page);
  private siteRepository = getRepository(Site);
  private userRepository = getRepository(User);

  /**
   * Get all sections for a page
   */
  @Get()
  async listSections(
    @QueryParams() query: SectionListQueryDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<PageSection[]>> {
    if (!query.pageId) {
      throw new BadRequestError('Page ID is required');
    }

    // Verify user has access to the page
    const page = await this.pageRepository.findOne({
      where: { id: query.pageId },
      relations: ['site'],
    });

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    // Verify user has access to the site
    const site = await this.siteRepository.findOne({
      where: { id: page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to access these sections');
    }

    // Build where clause
    const where: any = { page: page.id };
    
    // Filter by active status if needed
    if (query.activeOnly !== false) {
      where.isActive = true;
    }

    // Build order clause
    const order: any = {};
    order[query.sortBy || 'order'] = query.order || 'ASC';

    // Get sections
    const sections = await this.sectionRepository.find({
      where,
      order,
      relations: ['page'],
    });

    return {
      success: true,
      data: sections,
    };
  }

  /**
   * Get a single section by ID
   */
  @Get('/:id')
  @OnUndefined(NotFoundError)
  async getSection(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<ApiResponse<PageSection>> {
    const section = await this.sectionRepository.findOne({
      where: { id },
      relations: ['page', 'page.site'],
    });

    if (!section) {
      throw new NotFoundError('Section not found');
    }

    // Verify user has access to the site this section belongs to
    const site = await this.siteRepository.findOne({
      where: { id: section.page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to access this section');
    }

    return {
      success: true,
      data: section,
    };
  }

  /**
   * Create a new section
   */
  @Post()
  @HttpCode(201)
  async createSection(
    @Body() createSectionDto: CreateSectionDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<PageSection>> {
    // Validate DTO
    const errors = await validate(createSectionDto);
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', { errors });
    }

    // Verify page exists and user has access
    const page = await this.pageRepository.findOne({
      where: { id: createSectionDto.pageId },
      relations: ['site'],
    });

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    const site = await this.siteRepository.findOne({
      where: { id: page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to add sections to this page');
    }

    // Check if user has reached section limit for this page (if any)
    const sectionCount = await this.sectionRepository.count({ page: page.id });
    const maxSections = user.plan?.maxSectionsPerPage || 50; // Default to 50 sections per page if no plan
    
    if (sectionCount >= maxSections) {
      throw new ForbiddenError(`You have reached the maximum number of sections (${maxSections}) for this page`);
    }

    // Create new section
    const section = new PageSection();
    section.title = createSectionDto.title;
    section.type = createSectionDto.type || 'content';
    section.content = createSectionDto.content || {};
    section.settings = createSectionDto.settings || {};
    section.order = createSectionDto.order;
    section.isActive = createSectionDto.isActive !== false; // Default to true if not specified
    section.page = page;

    // Save section
    await this.sectionRepository.save(section);

    logger.info(`New section created: ${section.id} for page ${page.id} by user ${user.id}`);

    return {
      success: true,
      data: section,
      message: 'Section created successfully',
    };
  }

  /**
   * Update a section
   */
  @Put('/:id')
  async updateSection(
    @Param('id') id: string,
    @Body() updateSectionDto: UpdateSectionDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<PageSection>> {
    const section = await this.sectionRepository.findOne({
      where: { id },
      relations: ['page', 'page.site'],
    });

    if (!section) {
      throw new NotFoundError('Section not found');
    }

    // Verify user has access to the site this section belongs to
    const site = await this.siteRepository.findOne({
      where: { id: section.page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to update this section');
    }

    // Update section properties
    if (updateSectionDto.title !== undefined) {
      section.title = updateSectionDto.title;
    }

    if (updateSectionDto.type !== undefined) {
      section.type = updateSectionDto.type;
    }

    if (updateSectionDto.content !== undefined) {
      section.content = {
        ...(section.content || {}),
        ...updateSectionDto.content,
      };
    }

    if (updateSectionDto.settings !== undefined) {
      section.settings = {
        ...(section.settings || {}),
        ...updateSectionDto.settings,
      };
    }

    if (updateSectionDto.order !== undefined) {
      section.order = updateSectionDto.order;
    }

    if (updateSectionDto.isActive !== undefined) {
      section.isActive = updateSectionDto.isActive;
    }

    // Save changes
    await this.sectionRepository.save(section);

    return {
      success: true,
      data: section,
      message: 'Section updated successfully',
    };
  }

  /**
   * Reorder sections
   */
  @Post('/reorder')
  async reorderSections(
    @Body() reorderDto: ReorderSectionsDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<{ success: boolean }>> {
    if (!reorderDto.sectionIds || reorderDto.sectionIds.length === 0) {
      throw new BadRequestError('No section IDs provided');
    }

    // Get all sections to reorder
    const sections = await this.sectionRepository.find({
      where: { id: In(reorderDto.sectionIds) },
      relations: ['page', 'page.site'],
    });

    if (sections.length !== reorderDto.sectionIds.length) {
      throw new BadRequestError('One or more sections not found');
    }

    // Verify user has access to all sections
    for (const section of sections) {
      const site = await this.siteRepository.findOne({
        where: { id: section.page.site.id, owner: user },
      });

      if (!site) {
        throw new ForbiddenError(`You do not have permission to reorder section ${section.id}`);
      }
    }

    // Update order of each section
    const updatePromises = reorderDto.sectionIds.map((sectionId, index) => {
      return this.sectionRepository.update(sectionId, { order: index });
    });

    await Promise.all(updatePromises);

    logger.info(`Sections reordered by user ${user.id}`);

    return {
      success: true,
      data: { success: true },
      message: 'Sections reordered successfully',
    };
  }

  /**
   * Delete a section
   */
  @Delete('/:id')
  @HttpCode(204)
  @OnUndefined(204)
  async deleteSection(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<void> {
    const section = await this.sectionRepository.findOne({
      where: { id },
      relations: ['page', 'page.site'],
    });

    if (!section) {
      throw new NotFoundError('Section not found');
    }

    // Verify user has access to the site this section belongs to
    const site = await this.siteRepository.findOne({
      where: { id: section.page.site.id, owner: user },
    });

    if (!site) {
      throw new ForbiddenError('You do not have permission to delete this section');
    }

    // Prevent deleting the last section of a page
    const sectionCount = await this.sectionRepository.count({ page: section.page.id });
    if (sectionCount <= 1) {
      throw new BadRequestError('Cannot delete the last section of a page');
    }

    // Soft delete the section
    await this.sectionRepository.softRemove(section);

    logger.info(`Section ${section.id} deleted by user ${user.id}`);
  }
}
