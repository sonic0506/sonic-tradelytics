import { DataSource, type DataSourceOptions } from 'typeorm';

import { env } from '@/config/env.js';

import { SnakeNamingStrategy } from './snake-naming.strategy.js';

// 앱(TypeOrmModule)과 migration CLI가 같이 쓰는 설정이에요.
// CLI는 빌드 결과(dist)를 읽어요: npm run build && npm run migration:run
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false,
  // bigint를 문자열 대신 number로 받아요. 금액은 원 단위라 2^53(약 9천조)을 넘지 않아요.
  // numeric은 컬럼마다 numericTransformer로 바꿔요(common/database/numeric.transformer.ts).
  parseInt8: true,
  // 컬럼·FK 이름은 snake_case예요(authorId → author_id).
  namingStrategy: new SnakeNamingStrategy(),
  entities: [`${import.meta.dirname}/../../**/*.entity.js`],
  migrations: [`${import.meta.dirname}/migrations/*.js`],
};

export default new DataSource(dataSourceOptions);
