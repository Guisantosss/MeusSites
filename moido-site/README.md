# MOÍDO · site vitrine (Icreativa)

> No ar: https://guisantosss.github.io/meussites/moido-site/
> Contexto completo do projeto, decisões e próximos passos: **CLAUDE.md** (fica só na pasta local, não vai para o GitHub).

Site de demonstração de uma hamburgueria fictícia, com scroll animado, sequências de imagens e brasas 3D.
Vite + TypeScript, GSAP (ScrollTrigger, SplitText, DrawSVG), Lenis e Three.js. Fontes servidas pelo próprio site.

## Rodar

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # gera dist/
npm run preview    # serve dist/ em http://127.0.0.1:4173
```

## Estado atual

As fotos em `public/img` já são as reais (Gemini). As sequências em `public/seq` são provisórias, feitas das fotos
por `scripts/interim.py`, até os clipes do Google Flow chegarem.

## Trocar pelo material real (Gemini + Flow)

1. Ponha os clipes em `assets/raw/` (`f1-abrir.mp4`, `f2-prensa.mp4`, `f3-cheddar.mp4`). As fotos já estão lá.
2. Rode `python3 scripts/prepare_real.py assets/raw` (precisa de ffmpeg e Python com Pillow e numpy).
   Ele extrai os quadros dos clipes, mede a cor do fundo, recorta o fundo da G1 e reescreve `src/config.ts`.
3. Abra a última imagem de `public/seq/f1/` e ajuste `LABEL_ANCHORS` em `src/config.ts`
   (posição de cada rótulo em fração do quadro: x de 0 a 1 da esquerda, y de 0 a 1 do topo).
4. Se o clipe F2 tiver o impacto da prensa em outro momento, ajuste `IMPACT_AT` (fração do clipe).
5. `npm run build` e confira no navegador.

## Onde está cada coisa

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Estrutura e todos os textos do site |
| `src/styles.css` | Cores, tipografia e layout (tokens no topo) |
| `src/main.ts` | Carregamento, rolagem suave e a coreografia de cada seção |
| `src/sequence.ts` | Desenha as sequências de imagens no canvas conforme o scroll |
| `src/embers.ts` | Brasas 3D (Three.js), carregadas depois da primeira tela |
| `src/config.ts` | Contagem de quadros, cores de fundo, rótulos e momento do impacto |
| `scripts/interim.py` | Gera as sequências provisórias a partir das fotos (plano B de cada clipe) |
| `scripts/prepare_real.py` | Troca o provisório pelo real e mede tudo |
| `scripts/placeholders.py` | Ilustrações de teste do começo do projeto (não usar mais) |

## Publicação

O site é publicado pelo GitHub Pages: a cada envio para a branch `main` do repositório `meussites`, o workflow
`.github/workflows/deploy.yml` (na raiz do repositório) roda `npm ci` e `npm run build` aqui e publica a pasta `dist/`.

Os testes automáticos de memória e de rolagem usavam `window.__lenis` e `window.__seqs`; essas linhas saíram de
`src/main.ts` para publicar. Para medir de novo, recoloque as duas (depois de `lenis.stop()`) só na cópia local.
