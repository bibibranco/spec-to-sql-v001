type BridgeMessage = {
  type: string;
  payload?: unknown;
  source?: 'figma' | 'embedded-app';
};

const APP_URL = 'http://localhost:3000';
const APP_ORIGIN = new URL(APP_URL).origin;

const iframe = document.createElement('iframe');
iframe.src = APP_URL;
iframe.allow = 'clipboard-write';
iframe.style.border = '0';
iframe.style.width = '100%';
iframe.style.height = '100%';
iframe.style.background = 'transparent';

document.documentElement.lang = 'en';
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.height = '100%';
document.body.style.width = '100%';
document.body.appendChild(iframe);

type PendingMessage = {
  message: BridgeMessage;
  targetOrigin: string;
};

const pendingMessages: PendingMessage[] = [];
let iframeLoaded = false;

const sendToApp = (message: BridgeMessage) => {
  const targetOrigin = APP_ORIGIN;
  if (!iframeLoaded || !iframe.contentWindow) {
    pendingMessages.push({ message, targetOrigin });
    return;
  }
  iframe.contentWindow.postMessage(message, targetOrigin);
};

const flushPendingMessages = () => {
  if (!iframe.contentWindow) {
    return;
  }

  while (pendingMessages.length > 0) {
    const { message, targetOrigin } = pendingMessages.shift()!;
    iframe.contentWindow.postMessage(message, targetOrigin);
  }
};

const sendToFigma = (message: BridgeMessage) => {
  parent.postMessage(
    {
      pluginMessage: message,
    },
    '*',
  );
};

iframe.addEventListener('load', () => {
  iframeLoaded = true;
  flushPendingMessages();
  sendToApp({
    type: 'FIGMA_UI_READY',
    payload: { timestamp: Date.now() },
    source: 'figma',
  });
});

sendToFigma({
  type: 'FIGMA_UI_MOUNTED',
  payload: { timestamp: Date.now() },
  source: 'figma',
});

window.addEventListener('message', (event: MessageEvent) => {
  const pluginMessage: BridgeMessage | undefined = (event.data as { pluginMessage?: BridgeMessage })?.pluginMessage;

  if (pluginMessage) {
    sendToApp({
      type: pluginMessage.type,
      payload: pluginMessage.payload,
      source: 'figma',
    });
    return;
  }

  const isFromApp = event.source === iframe.contentWindow && event.origin === APP_ORIGIN;
  if (isFromApp) {
    const appMessage = event.data as BridgeMessage;
    sendToFigma({
      type: appMessage.type,
      payload: appMessage.payload,
      source: 'embedded-app',
    });
  }
});
