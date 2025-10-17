// Plugin sem UI: coleta frames "tagueamento" e abre localhost com payload Base64

type SimplifiedColor = {
  type: 'SOLID';
  r: number; g: number; b: number; a: number;
};

type SimplifiedText = {
  id: string;
  name: string;
  characters: string;
  fontName: string | 'MIXED' | 'UNKNOWN';
  fills: SimplifiedColor | null;
  bounds: { x: number; y: number; width: number; height: number };
};

type SimplifiedComponentRef = {
  id: string;
  name: string;
  nodeType: 'INSTANCE' | 'COMPONENT' | 'COMPONENT_SET';
};

type SimplifiedFrame = {
  id: string;
  name: string;
  nodeType: 'FRAME';
  textNodes: SimplifiedText[];
  components: SimplifiedComponentRef[];
};

type Payload = {
  fileKey: string | null;
  fileName: string;
  pageId: string;
  pageName: string;
  frames: SimplifiedFrame[];
};

function isTagueamentoFrame(node: SceneNode): node is FrameNode {
  return node.type === 'FRAME' && /tagueamento/i.test(node.name);
}

function simplifyColor(paint: Paint): SimplifiedColor | null {
  if (paint.type !== 'SOLID') return null;
  const c = paint.color;
  const a = (paint.opacity === undefined ? 1 : paint.opacity);
  return { type: 'SOLID', r: c.r, g: c.g, b: c.b, a };
}

function getNodeXY(n: SceneNode): { x: number; y: number } {
  // absoluteTransform é [[a, b, x], [c, d, y]]
  const m = (n as any).absoluteTransform as Transform | undefined;
  if (m && m.length === 2 && m[0].length === 3 && m[1].length === 3) {
    return { x: m[0][2], y: m[1][2] };
  }
  // fallback
  const anyN = n as any;
  return { x: anyN.x ?? 0, y: anyN.y ?? 0 };
}

function readFontNameSafe(t: TextNode): string | 'MIXED' | 'UNKNOWN' {
  try {
    const fn = t.fontName;
    if (fn === figma.mixed) return 'MIXED';
    if (typeof fn === 'object' && 'family' in fn && 'style' in fn) {
      return `${(fn as FontName).family} ${(fn as FontName).style}`;
    }
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

function readFillsSolidSafe(n: GeometryMixin): SimplifiedColor | null {
  try {
    const fills = n.fills;
    if (fills === figma.mixed || !Array.isArray(fills) || fills.length === 0) return null;
    for (const p of fills) {
      const sc = simplifyColor(p as Paint);
      if (sc) return sc;
    }
    return null;
  } catch {
    return null;
  }
}

function collectTextData(frame: FrameNode): SimplifiedText[] {
  const texts = frame.findAll(n => n.type === 'TEXT') as TextNode[];
  return texts.map(t => {
    const { x, y } = getNodeXY(t);
    const fontName = readFontNameSafe(t);
    const fills = readFillsSolidSafe(t);
    return {
      id: t.id,
      name: t.name,
      characters: t.characters,
      fontName,
      fills,
      bounds: { x, y, width: t.width, height: t.height }
    };
  });
}

function collectInstanceAndComponents(frame: FrameNode): SimplifiedComponentRef[] {
  const nodes = frame.findAll(
    n => n.type === 'INSTANCE' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
  ) as (InstanceNode | ComponentNode | ComponentSetNode)[];
  return nodes.map(n => ({
    id: n.id,
    name: n.name,
    nodeType: n.type as SimplifiedComponentRef['nodeType']
  }));
}

function collectTagueamento(): Payload {
  const page = figma.currentPage;
  const frames = page.findAll(isTagueamentoFrame);

  const simplifiedFrames: SimplifiedFrame[] = (frames as FrameNode[]).map(f => ({
    id: f.id,
    name: f.name,
    nodeType: 'FRAME',
    textNodes: collectTextData(f),
    components: collectInstanceAndComponents(f),
  }));

  return {
    fileKey: figma.fileKey ?? null,
    fileName: figma.root.name,
    pageId: page.id,
    pageName: page.name,
    frames: simplifiedFrames
  };
}

function serializePayload(obj: Payload): { base64: string; reduced: boolean; used: any } {
  const json = JSON.stringify(obj);
  if (json.length <= 150_000) {
    const base64 = figma.base64Encode(new TextEncoder().encode(json));
    return { base64, reduced: false, used: obj };
  }
  // Reduzido
  const reduced = {
    fileKey: obj.fileKey,
    fileName: obj.fileName,
    pageId: obj.pageId,
    pageName: obj.pageName,
    frames: obj.frames.map(f => ({
      id: f.id,
      name: f.name,
      nodeType: 'FRAME' as const,
      textCount: f.textNodes.length,
      componentsCount: f.components.length
    }))
  };
  const base64 = figma.base64Encode(new TextEncoder().encode(JSON.stringify(reduced)));
  return { base64, reduced: true, used: reduced };
}

async function openWithPayload(base64: string, reduced: boolean) {
  const url = `http://localhost:5173/#payload=${encodeURIComponent(base64)}`;
  await figma.openExternal(url);
  figma.notify(reduced ? 'Payload grande: enviado resumo para o localhost.' : 'Payload enviado para o localhost.');
}

async function main() {
  try {
    figma.notify('Buscando tagueamento…');

    const data = collectTagueamento();
    const framesCount = data.frames.length;
    const textsTotal = data.frames.reduce((acc, f) => acc + f.textNodes.length, 0);

    figma.notify(`Encontrados ${framesCount} frame(s) "tagueamento", ${textsTotal} texto(s).`);

    const { base64, reduced } = serializePayload(data);
    await openWithPayload(base64, reduced);
  } catch (err: any) {
    const msg = (err && err.message) ? err.message : String(err);
    figma.notify(`Erro: ${msg}`);
  } finally {
    figma.closePlugin();
  }
}

// Executa imediatamente ao abrir o plugin
main();