// Decodifica os quadros fora da linha principal (o Safari costuma decodificar imagens nela, o que trava a rolagem).
// Recebe { g, blob } e devolve { g, bmp } transferindo a ImageBitmap (sem cópia).
self.onmessage = async ({ data: { g, blob } }) => {
  try {
    const bmp = await createImageBitmap(blob);
    self.postMessage({ g, bmp }, [bmp]);
  } catch {
    self.postMessage({ g, bmp: null });
  }
};
