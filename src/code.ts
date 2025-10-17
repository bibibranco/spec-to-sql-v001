declare const __html__: string;

type BridgeMessage = {
  type: string;
  payload?: unknown;
};

const APP_ORIGIN = 'http://localhost:3000';

// Render the UI and keep enough room for the embedded app.
figma.showUI(__html__, {
  width: 480,
  height: 640,
  themeColors: true,
});

const sendToUI = (message: BridgeMessage) => {
  figma.ui.postMessage(message);
};

figma.on('run', () => {
  sendToUI({
    type: 'FIGMA_PLUGIN_READY',
    payload: {
      documentName: figma.root.name,
      appOrigin: APP_ORIGIN,
      timestamp: Date.now(),
    },
  });
});

figma.ui.onmessage = (message: BridgeMessage) => {
  if (!message || typeof message.type !== 'string') {
    return;
  }

  const { type, payload } = message;

  switch (type) {
    case 'APP_READY': {
      figma.notify('Embedded app connected');
      break;
    }
    case 'CREATE_RECTANGLE': {
      const width = Math.max(10, Number((payload as Record<string, unknown>)?.width) || 120);
      const height = Math.max(10, Number((payload as Record<string, unknown>)?.height) || 80);
      const node = figma.createRectangle();
      node.name = 'Created by spec-to-sql-v001';
      node.resize(width, height);
      figma.currentPage.appendChild(node);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);

      sendToUI({
        type: 'FIGMA_RECTANGLE_CREATED',
        payload: { id: node.id, width: node.width, height: node.height },
      });
      break;
    }
    default: {
      console.info('[spec-to-sql-v001] Unhandled message from UI', { type, payload });
      break;
    }
  }
};
