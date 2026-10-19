// Tudo o que muda quando as imagens e os clipes reais chegarem fica aqui.
// scripts/prepare_real.py reescreve este arquivo com os valores medidos nos arquivos reais.

export type Fit = "subject" | "cover";

export interface SeqConfig {
  dir: string;      // pasta dos quadros, relativa ao site
  count: number;    // total de quadros
  width: number;    // tamanho original dos quadros
  height: number;
  bg: string;       // cor do fundo medida nos quadros (para emendar sem borda)
  fit: Fit;         // "subject": o objeto cabe inteiro na tela; "cover": preenche a tela
  subject?: { w: number; h: number }; // fração do quadro ocupada pelo objeto (fit "subject")
  mobileCrop: number; // celular (pasta <dir>-m, metade dos quadros): fração central da largura guardada
}

export const SEQ: Record<"f1" | "f2" | "f3", SeqConfig> = {
  f1: { dir: "seq/f1", count: 120, width: 1600, height: 900, bg: "#171410", fit: "subject", subject: { w: 0.46, h: 0.86 }, mobileCrop: 1 },
  f2: { dir: "seq/f2", count: 96, width: 1600, height: 900, bg: "#1B1912", fit: "cover", mobileCrop: 0.5 },
  f3: { dir: "seq/f3", count: 72, width: 1600, height: 900, bg: "#351F13", fit: "cover", mobileCrop: 0.5 },
};

// Onde está o hambúrguer montado dentro da G1 (fração do quadro): centro vertical e altura.
// Usado para centralizar o lanche entre as duas linhas do título na abertura.
export const HERO_BURGER = { cy: 0.486, h: 0.570 };

// Momento do impacto da prensa, em fração do clipe F2 (a tela treme aqui).
// Clipe do Flow: a prensa encosta na carne em 1,85 s do trecho 0,15 a 7,3 s.
export const IMPACT_AT = 0.24;

// Onde cada rótulo encosta na camada, em fração do quadro FINAL do F1 (hambúrguer aberto).
// side: de que lado do lanche o texto fica no desktop. Medido no quadro 120 do clipe do Flow.
export const LABEL_ANCHORS = [
  { x: 0.625, y: 0.19, side: "right" },  // brioche
  { x: 0.6, y: 0.272, side: "right" },   // molho (escorrendo do pão)
  { x: 0.386, y: 0.332, side: "left" },  // picles
  { x: 0.39, y: 0.42, side: "left" },    // cebola
  { x: 0.622, y: 0.492, side: "right" }, // cheddar
  { x: 0.366, y: 0.565, side: "left" },  // blend
] as const;
