'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@xonic0506/sonic-ui';

import {
  BOT_STAGE_LABEL,
  type BotListRow,
  BotStatusBadge,
  getBudgetDetail,
  getStageDetail,
} from '@/entities/bot';
import { formatSignedPercent, formatSignedWon, formatWon } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

import type { BotSortKey, SortDirection } from '../lib/bot-list-order';
import { BotName } from './bot-name';
import { BotRowMenu } from './bot-row-menu';

const COLUMNS: { key: BotSortKey; label: string; isNumber?: boolean }[] = [
  { key: 'name', label: '봇' },
  { key: 'status', label: '상태' },
  { key: 'stage', label: '단계' },
  { key: 'budget', label: '투자금', isNumber: true },
  { key: 'pnl', label: '오늘 손익', isNumber: true },
];

type BotTableHeaderProps = {
  sort?: { key: BotSortKey; direction: SortDirection };
  onSort?: (key: BotSortKey) => void;
};

export function BotTableHeader({ sort, onSort }: BotTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        {COLUMNS.map(({ key, label, isNumber }) => (
          <TableHead
            key={key}
            {...(isNumber ? { align: 'end' as const } : {})}
            {...(sort
              ? { sort: sort.key === key ? sort.direction : ('none' as const) }
              : {})}
            {...(onSort ? { onSort: () => onSort(key) } : {})}
          >
            {label}
          </TableHead>
        ))}
        <TableHead>
          <span className="sr-only">동작</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

type BotTableProps = {
  bots: BotListRow[];
  sort: { key: BotSortKey; direction: SortDirection };
  onSort: (key: BotSortKey) => void;
};

// 데스크톱 봇 목록. 모든 열을 눌러 정렬해요.
export function BotTable({ bots, sort, onSort }: BotTableProps) {
  return (
    <Table aria-label="봇 목록">
      <BotTableHeader sort={sort} onSort={onSort} />
      <TableBody>
        {bots.map((bot) => (
          <TableRow key={bot.id}>
            <TableCell className="py-3">
              <BotName bot={bot} />
            </TableCell>
            <TableCell className="py-3">
              <div className="flex flex-col items-start gap-1">
                <BotStatusBadge status={bot.status} />
                {bot.statusDetail && (
                  <Text variant="caption" tone="muted">
                    {bot.statusDetail}
                  </Text>
                )}
              </div>
            </TableCell>
            <TableCell className="py-3">
              <div className="flex flex-col">
                <Text>{BOT_STAGE_LABEL[bot.stage]}</Text>
                <Text variant="caption" tone="muted">
                  {getStageDetail(bot)}
                </Text>
              </div>
            </TableCell>
            <TableCell align="end" className="py-3">
              <div className="flex flex-col items-end">
                <Text variant="mono">{formatWon(bot.budget ?? 0)}</Text>
                <Text variant="caption" tone="muted">
                  {getBudgetDetail(bot)}
                </Text>
              </div>
            </TableCell>
            <TableCell align="end" className="py-3">
              <div className="flex flex-col items-end">
                <PnlText value={bot.todayPnl}>
                  {formatSignedWon(bot.todayPnl)}
                </PnlText>
                <PnlText value={bot.todayPnl} variant="mono-caption">
                  {formatSignedPercent(bot.todayPnlRate)}
                </PnlText>
              </div>
            </TableCell>
            <TableCell className="py-3">
              <BotRowMenu bot={bot} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
