# Agendari · agenda de classe

Agenda de classe senzilla per apuntar **tasques, deures i dates rellevants**,
organitzades per **matèries amb color**. Funciona al navegador, sense comptes ni
servidors: les dades es desen al dispositiu i es poden exportar quan vulguis.

👉 **App publicada: https://vmoren12.github.io/agendaclasse/**

## Què fa

- **Cinc vistes**: dia, setmana, mes, any i agenda (llista completa).
- **Tipus d'entrada**: tasca, deures, data rellevant i altres. Les tasques i els
  deures es poden marcar com a fets.
- **Matèries editables**: afegeix-ne, canvia'ls el nom i tria el color de cada
  una. El color es veu a totes les vistes.
- **Nom de la classe editable**: clica el nom que hi ha al costat del títol.
- **Temes**: clar, fosc o automàtic (segueix el sistema), amb cinc colors d'accent.
- **Còpies de seguretat**: exportació i importació en JSON; en importar,
  l'app pregunta si vols combinar o substituir. Es poden programar còpies
  automàtiques **cada X canvis** o **cada X minuts, hores, dies o setmanes**.
- **PWA**: es pot instal·lar al mòbil o a l'escriptori i funciona sense connexió.
- **Accessible i responsive**: teclat, lectors de pantalla, mòbil i escriptori.

### Dreceres de teclat

| Tecla | Acció |
| --- | --- |
| `N` | Nova entrada |
| `T` | Anar a avui |
| `←` / `→` | Període anterior / següent |
| `1` … `5` | Dia, setmana, mes, any, agenda |
| `Esc` | Tancar el diàleg obert |

## Les teves dades

Tot es desa a `localStorage` del navegador (clau `agendari.data.v2`). No hi ha
cap servidor, cap compte ni cap seguiment. Això vol dir dues coses:

1. Les dades no viatgen enlloc.
2. Si esborres les dades del navegador, es perden — per això hi ha les còpies.

El fitxer d'exportació és JSON llegible:

```json
{
  "app": "Agendari",
  "version": 2,
  "exportedAt": "2026-09-13T18:00:00.000Z",
  "settings": { "className": "6è B", "themeMode": "auto", "accent": "verd" },
  "subjects": [{ "id": "s...", "name": "Matemàtiques", "color": "#5B4B9B" }],
  "entries": [
    {
      "id": "e...",
      "date": "2026-09-15",
      "title": "Entrega del treball",
      "type": "tasca",
      "subjectId": "s...",
      "notes": "",
      "done": false
    }
  ]
}
```

En triar un fitxer, l'app el llegeix, te'n mostra el resum (entrades, matèries,
classe i data) i et deixa decidir: **combinar** manté el que ja tens i afegeix el
que falta (si una entrada existeix als dos costats, guanya la modificada més
tard); **substituir** canvia tota l'agenda per la del fitxer.

Les còpies automàtiques per temps es comproven en obrir l'app, en tornar-hi i
un cop per minut mentre és oberta. Com que el navegador no deixa baixar fitxers
sense una acció teva, si venç mentre treballes la còpia surt sola després del
següent canvi; si venç amb l'app aturada, en tornar veuràs un avís amb el botó
per desar-la.

## Estructura del projecte

```
index.html               Estructura de la pàgina i els dos diàlegs
manifest.webmanifest     Metadades de la PWA
sw.js                    Service worker (funcionament sense connexió)
assets/css/styles.css    Estils, tokens de tema i responsive
assets/js/
  app.js                 Punt d'entrada: estat de la interfície i connexions
  store.js               Dades, validació, persistència i esdeveniments
  views.js               Dibuix de les cinc vistes
  dialogs.js             Formulari d'entrada i full de configuració
  backup.js              Exportació, importació i còpies programades
  dates.js               Utilitats de dates en català
  theme.js               Tema clar/fosc i color d'accent
  dom.js, toast.js       Ajudes de DOM i avisos breus
assets/fonts/            Fraunces i Inter (OFL), auto-allotjades
assets/icons/            Icones de la PWA
tools/make-icons.py      Generador de les icones (només si en canvies el disseny)
```

No hi ha cap dependència ni cap pas de compilació: és HTML, CSS i JavaScript
amb mòduls ES natius.

## Desenvolupament local

Com que fa servir mòduls ES i un service worker, cal servir la carpeta (obrir
`index.html` amb doble clic no és suficient):

```bash
python -m http.server 8000
# o bé
npx serve .
```

I obre <http://localhost:8000>.

En publicar canvis, puja `CACHE_VERSION` a `sw.js` perquè els navegadors que ja
tenen l'app instal·lada es refresquin.

## Publicació

Cada `push` a `main` dispara el flux de treball
[`.github/workflows/pages.yml`](.github/workflows/pages.yml), que publica el
contingut del repositori a GitHub Pages.

La primera vegada cal activar Pages una sola vegada al repositori:
**Settings › Pages › Build and deployment › Source: _GitHub Actions_**. A partir
d'aquí, cada canvi es publica sol.

## Llicència

Codi sota llicència [MIT](LICENSE). Les tipografies mantenen la seva llicència
OFL 1.1 (vegeu [`assets/fonts/README.md`](assets/fonts/README.md)).
