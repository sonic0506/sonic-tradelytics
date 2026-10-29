// api → engine 명령 (ADR-0004, POL-RISK-10, FR-BOT-09)
export const COMMAND_KINDS = [
  'pause',
  'resume',
  'liquidate',
  'kill',
  'rebudget',
] as const;
export type CommandKind = (typeof COMMAND_KINDS)[number];

export const COMMAND_RESULTS = ['ok', 'failed'] as const;
export type CommandResult = (typeof COMMAND_RESULTS)[number];
