// src/ui/main.ts
const appUrl = 'http://localhost:3000'; // tua aplicação

// Cria o iframe
const iframe = document.createElement('iframe');
iframe.src = appUrl;
iframe.style.width = '100%';
iframe.style.height = '100vh';
iframe.style.border = 'none';
document.body.style.margin = '0';
document.body.appendChild(iframe);

// Comunicação UI <-> code.ts
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  // Exemplo: repassar mensagem pro app dentro do iframe
  iframe.contentWindow?.postMessage(msg, appUrl);
};

// Exemplo: enviar mensagem pro code.ts
function sendToFigma(type: string, payload: any = {}) {
  parent.postMessage({ pluginMessage: { type, payload } }, '*');
}

// Exemplo: quando o app dentro do iframe mandar algo de volta
window.addEventListener('message', (e) => {
  if (e.origin === appUrl && e.data?.type === 'READY') {
    console.log('App embutido está pronto!');
    sendToFigma('PING', { message: 'UI ready' });
  }
});