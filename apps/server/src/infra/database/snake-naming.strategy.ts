import { DefaultNamingStrategy } from 'typeorm';

// authorId → author_id, HTTPStatus → http_status
const snake = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

// DB 이름은 snake_case예요(harness.md 4절). 코드의 프로퍼티는 camelCase 그대로예요.
// 테이블 이름은 @Entity('order_items')로 직접 적고, @Column({ name })으로 준 이름은 그대로 써요.
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return customName ?? snake([...embeddedPrefixes, propertyName].join('_'));
  }

  // relation author + 참조 컬럼 id → author_id (같은 이름의 authorId 컬럼과 합쳐져요)
  override joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(
    firstTableName: string,
    _secondTableName: string,
    firstPropertyName: string,
  ): string {
    return snake(`${firstTableName}_${firstPropertyName.replaceAll('.', '_')}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snake(`${tableName}_${columnName ?? propertyName}`);
  }
}
