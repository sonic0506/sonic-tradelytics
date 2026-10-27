import type { PageQueryDto } from './page-query.dto.js';

export class PageMetaDto {
  page: number;
  size: number;
  total: number;
}

// 목록 응답은 { items, meta } 하나로 통일해요.
export class PageDto<T> {
  items: T[];
  meta: PageMetaDto;

  static of<T>(items: T[], total: number, query: PageQueryDto): PageDto<T> {
    const page = new PageDto<T>();
    page.items = items;
    page.meta = { page: query.page, size: query.size, total };
    return page;
  }
}
