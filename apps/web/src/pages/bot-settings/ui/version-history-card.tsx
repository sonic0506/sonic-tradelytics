'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@xonic0506/sonic-ui';

import {
  type BotVersion,
  useBotVersionsQuery,
  type VersionChangeKind,
} from '@/entities/bot';
import { formatMonthDayTime } from '@/shared/lib';

const CHANGE_KIND_LABEL: Record<VersionChangeKind, string> = {
  initial: '처음 만든 값',
  decision_change: '판단 변경',
  risk_only: '위험만 줄임',
};

// 그 버전이 검증 구간에 준 영향 (POL-RISK-13)
function getVerificationText({ changeKind, appliedAt }: BotVersion) {
  switch (changeKind) {
    case 'initial':
      return '처음 시작';
    case 'decision_change':
      return appliedAt ? '다시 시작' : '적용 때 다시 시작';
    case 'risk_only':
      return '이어서';
  }
}

// 규칙 값 버전 기록 (Figma Card / 버전 기록, FR-BOT-03)
export function VersionHistoryCard({ botId }: { botId: string }) {
  const { data } = useBotVersionsQuery(botId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>규칙 값 버전</CardTitle>
        <CardDescription>
          지난 버전 기록은 지우지 않고 그대로 둬요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <Table aria-label="규칙 값 버전">
          <TableHeader>
            <TableRow>
              <TableHead>버전</TableHead>
              <TableHead>변경 종류</TableHead>
              <TableHead>바뀐 값</TableHead>
              <TableHead>저장</TableHead>
              <TableHead>적용</TableHead>
              <TableHead>검증 구간</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.version}>
                <TableCell>v{item.version}</TableCell>
                <TableCell>{CHANGE_KIND_LABEL[item.changeKind]}</TableCell>
                <TableCell>
                  {item.changes.length === 0
                    ? '−'
                    : item.changes
                        .map(
                          (change) =>
                            `${change.label} ${change.from} → ${change.to}`,
                        )
                        .join(', ')}
                </TableCell>
                <TableCell>{formatMonthDayTime(item.createdAt)}</TableCell>
                <TableCell>
                  {item.appliedAt
                    ? formatMonthDayTime(item.appliedAt)
                    : '적용 대기'}
                </TableCell>
                <TableCell>{getVerificationText(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
