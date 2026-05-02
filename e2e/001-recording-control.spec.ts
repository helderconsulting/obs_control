import { expect, type Page, test } from '@playwright/test';

type RecordingMockMode = 'success' | 'obs-unavailable';

const installRecordingMocks = async (page: Page, mode: RecordingMockMode): Promise<void> => {
  await page.route('**/recording', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'idle',
        lastRecordingFilename: null,
      }),
    });
  });

  await page.route('**/obs/connection', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'connected',
        url: 'ws://127.0.0.1:4455',
        checkedAt: new Date().toISOString(),
        message: 'Connected to OBS websocket.',
      }),
    });
  });

  await page.addInitScript((selectedMode) => {
    class RecordingWebSocketMock extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readonly url: string;
      readonly protocol = '';
      readonly extensions = '';
      readonly bufferedAmount = 0;
      binaryType: BinaryType = 'blob';
      readyState = RecordingWebSocketMock.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: Event) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);

        setTimeout(() => {
          this.readyState = RecordingWebSocketMock.OPEN;
          const event = new Event('open');
          this.onopen?.(event);
          this.dispatchEvent(event);
        }, 0);
      }

      send(data: string): void {
        const command = JSON.parse(data) as { type: string };
        const payload =
          selectedMode === 'obs-unavailable'
            ? {
                type: 'recording.failed',
                aggregate: 'recording',
                occurredAt: new Date().toISOString(),
                delta: {
                  status: 'error',
                  message: 'Unable to start recording because OBS is unavailable.',
                  lastRecordingFilename: null,
                },
              }
            : command.type === 'recording.start'
              ? {
                  type: 'recording.started',
                  aggregate: 'recording',
                  occurredAt: new Date().toISOString(),
                  delta: {
                    status: 'recording',
                    lastRecordingFilename: null,
                  },
                }
              : {
                  type: 'recording.stopped',
                  aggregate: 'recording',
                  occurredAt: new Date().toISOString(),
                  delta: {
                    status: 'idle',
                    lastRecordingFilename: '/recordings/session-001.mkv',
                  },
                };

        setTimeout(() => {
          const event = new MessageEvent('message', {
            data: JSON.stringify(payload),
          });
          this.onmessage?.(event);
          this.dispatchEvent(event);
        }, 0);
      }

      close(): void {
        this.readyState = RecordingWebSocketMock.CLOSED;
        const event = new Event('close');
        this.onclose?.(event);
        this.dispatchEvent(event);
      }
    }

    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: RecordingWebSocketMock,
    });
  }, mode);
};

test.describe('recording control', () => {
  test('starts and stops recording from the main controls', async ({ page }) => {
    await installRecordingMocks(page, 'success');

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /recording/i })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/idle/i);

    await expect(page.getByRole('button', { name: /start recording/i })).toBeVisible();
    await page.getByRole('button', { name: /start recording/i }).click();

    await expect(page.getByRole('status')).toContainText(/recording/i);
    await expect(page.getByRole('button', { name: /stop recording/i })).toBeVisible();

    await page.getByRole('button', { name: /stop recording/i }).click();

    await expect(page.getByRole('status')).toContainText(/idle/i);
    await expect(page.getByText('/recordings/session-001.mkv')).toBeVisible();
    await expect(page.getByRole('button', { name: /start recording/i })).toBeVisible();
  });

  test('shows an error when the backend cannot reach OBS', async ({ page }) => {
    await installRecordingMocks(page, 'obs-unavailable');

    await page.goto('/');

    await page.getByRole('button', { name: /start recording/i }).click();

    await expect(page.getByRole('alert')).toContainText(/unable to start recording|obs/i);
    await expect(page.getByRole('status')).not.toContainText(/recording/i);
  });
});
