import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ServerErrorPage } from './server-error-page';

describe('ServerErrorPage', () => {
  it('다시 시도를 누르면 페이지를 다시 그려요', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ServerErrorPage reset={reset} />);
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
