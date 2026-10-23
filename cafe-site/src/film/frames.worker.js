// Ajudante do filme, fora da linha principal: baixa os pacotes de quadros aos poucos (streaming), separa cada
// quadro comprimido assim que os bytes dele chegam e decodifica sob pedido.
//
// Mensagens recebidas:  { type: "init", base, heads, scenes: [{ id, offset, pack }], essential }
//                       { type: "decode", g }
// Mensagens enviadas:   { type: "have", list }   quadros (índice global) que já podem ser decodificados
//                       { type: "progress", p }  0..1 do essencial (1º quadro de cada cena + a 1ª cena inteira)
//                       { type: "ready" }        essencial completo
//                       { type: "decoded", g, bmp }  ImageBitmap transferida (sem cópia), ou null
let blobs = [];
let pendingHave = [];
let flushTimer = 0;

const flushHave = () => {
  flushTimer = 0;
  if (pendingHave.length) {
    self.postMessage({ type: "have", list: pendingHave });
    pendingHave = [];
  }
};
const have = (g) => {
  pendingHave.push(g);
  if (!flushTimer) flushTimer = setTimeout(flushHave, 60); // agrupa: uma mensagem a cada 60 ms, não uma por quadro
};

/**
 * Lê um pacote em streaming. `items` = [{ g, offset, length }] na ordem do arquivo. Cada quadro vira um Blob assim
 * que os bytes dele estão completos. `onBytes(n)` informa quantos bytes chegaram (para o progresso).
 */
async function readPack(url, items, total, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = new Uint8Array(total);
  let received = 0;
  let next = 0;
  const release = () => {
    while (next < items.length && items[next].offset + items[next].length <= received) {
      const { g, offset, length } = items[next++];
      blobs[g] = new Blob([buf.subarray(offset, offset + length)], { type: "image/webp" });
      have(g);
    }
  };
  if (res.body?.getReader) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf.set(value.subarray(0, Math.max(0, Math.min(value.length, total - received))), received);
      received += value.length;
      onBytes?.(value.length);
      release();
    }
  } else {
    const all = new Uint8Array(await res.arrayBuffer());
    buf.set(all.subarray(0, total));
    received = all.length;
    onBytes?.(all.length);
  }
  received = Math.min(received, total);
  release();
}

async function init({ base, heads, scenes, essential }) {
  const total = scenes.reduce((n, s) => n + s.count, 0);
  blobs = new Array(total).fill(null);
  const offsetOf = Object.fromEntries(scenes.map((s) => [s.id, s.offset]));
  // essencial = heads.pack + o pacote da 1ª cena
  const essentialBytes = heads.bytes + (essential ? scenes.find((s) => s.id === essential)?.pack.bytes ?? 0 : 0);
  let essentialGot = 0;
  const onEssential = (n) => {
    essentialGot += n;
    self.postMessage({ type: "progress", p: Math.min(1, essentialGot / essentialBytes) });
  };

  try {
    await readPack(`${base}${heads.file}`, heads.entries.map(([id, i, offset, length]) => ({ g: offsetOf[id] + i, offset, length })),
      heads.bytes, onEssential);
    for (const s of scenes) {
      const items = s.pack.entries.map(([i, offset, length]) => ({ g: s.offset + i, offset, length }));
      await readPack(`${base}${s.pack.file}`, items, s.pack.bytes, s.id === essential ? onEssential : null);
      if (s.id === essential) {
        flushHave();
        self.postMessage({ type: "progress", p: 1 });
        self.postMessage({ type: "ready" });
      }
    }
  } catch (err) {
    self.postMessage({ type: "error", message: String(err) });
    self.postMessage({ type: "ready" }); // não prende o preloader: o filme mostra o que tiver
  }
  flushHave();
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") init(data);
  else if (data.type === "decode") {
    const blob = blobs[data.g];
    if (!blob) return self.postMessage({ type: "decoded", g: data.g, bmp: null });
    try {
      const bmp = await createImageBitmap(blob);
      self.postMessage({ type: "decoded", g: data.g, bmp }, [bmp]);
    } catch {
      self.postMessage({ type: "decoded", g: data.g, bmp: null });
    }
  }
};
