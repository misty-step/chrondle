# Bundled typefaces

Chrondle bundles the unmodified, normal-style variable Outfit and Karla fonts from
Google Fonts. `src/app/layout.tsx` uses `next/font/local` to emit same-origin assets:
no Google Fonts stylesheet or font download is needed during builds or browsing.
The existing CSS variables, swap display and weights 400–700 are preserved.

Upstream provenance (each family includes its own unmodified SIL OFL license):

- `Outfit.ttf`
  - Google Fonts commit: `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`
  - SHA-256: `fc7287273e66929776e2ba54f144fe699080bec29f61bf649d70d871468aeade`
- `Karla.ttf`
  - Google Fonts commit: `130fcfb0ff422fec96b335616b2ca99f91914792`
  - SHA-256: `ed3ca4cd9bdd899c543927c30bf5ff50706b24b3f2b7328e64b25f7d2a9d23dc`

Source paths in `google/fonts`: `ofl/outfit/Outfit[wght].ttf` and
`ofl/karla/Karla[wght].ttf`; the respective `OFL.txt` files are included here as
`Outfit-OFL.txt` and `Karla-OFL.txt`. Updates must preserve the licenses and refresh
this provenance. The TTF bytes are upstream originals, not subset or recompressed
variants. This removes a repeated `next/font/google` build failure caused by
parsing a live Google Fonts response; it does not redesign the typography.
