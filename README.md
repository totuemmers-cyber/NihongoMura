# Nihongo Mura · 日本語村

Eine Japanisch-Sprachsimulation im Browser: Ein Einheimischer lebt seinen Alltag in einem Dorf der Edo-Zeit und spricht dabei, ein deutscher Reisender hört zu und lernt Wörter. Kein Build-Schritt, keine Abhängigkeiten – `index.html` im Browser öffnen genügt (auch direkt als Datei).

## Aufbau

Die Skripte sind normale `<script>`-Dateien, die in der Reihenfolge aus `index.html` geladen werden und sich einen globalen Namensraum teilen. Eine Datei darf beim Laden nur benutzen, was in früheren Dateien steht; Funktionsaufrufe zur Laufzeit gehen quer durch alle Dateien.

| Datei | Inhalt |
|---|---|
| `css/style.css` | Gestaltung von Kopfzeile, Befehlszeile und Seitenleiste |
| `js/glyphs.js` | Alle CJK-Zeichen des Spiels (erzeugt, nicht von Hand ändern) |
| `js/fonts.js` | Lädt die Webfonts als kleine Teilmenge mit genau diesen Zeichen |
| `js/config.js` | Weltgröße, Zeittakt, Namen, Zufallshelfer |
| `js/audio.js` | Prozedurale Musik, Naturklänge und Effekte (Web Audio) |
| `js/data/vocabulary.js` | **Wortschatz**: jedes lernbare Wort |
| `js/world.js` | Orte im Dorf, der Fluss und die Wegfindung |
| `js/data/actions.js` | **Handlungen** des Einheimischen mit ihren Satzvorlagen |
| `js/festivals.js` | Vier-Zeichen-Redewendungen und Jahresfeste |
| `js/state.js` | Spielzustand, Dorf-Meilensteine, Sprichwörter, `Person` |
| `js/language.js` | **Sprach-Engine**: Bedeutungsrahmen → natürliches Japanisch und Deutsch |
| `js/overlays.js` | Sprechblasen, Kalligrafie, Lern-Effekte, `learnWord` |
| `js/render.js` | Zeichnen: Kamera, Gelände, Objekte, Figuren, Schatten |
| `js/ai.js` | Verhalten von Sprecher und Lernendem, Geschichten, Entdeckungen |
| `js/ui.js` | Seitenleiste, Ereignisprotokoll, Uhr, Geschwindigkeit |
| `js/villagers.js` | Dorfbewohner, Tiere, Beziehungen |
| `js/weather.js` | Wetter, Jahreszeiten, Licht und Atmosphäre |
| `js/events.js` | Kleine Zwischenfälle und Begegnungen |
| `js/interaction.js` | Klicks auf Orte, Quiz, getippte Befehle |
| `js/save.js` | Speichern und Laden (localStorage) |
| `js/main.js` | Start, Spielschleife, Eingaben |

## Ein neues Wort hinzufügen

1. Eintrag in `js/data/vocabulary.js` (bei Verben mit `vclass`). Gibt es dasselbe Wort schon in anderer Bedeutung (gleiche Schreibung und Lesung, z. B. 聞く = hören/fragen), den zweiten Eintrag mit `same: '<id>'` markieren.
2. Deutsch in `js/language.js`: Substantive brauchen ein Geschlecht in `DE_NOUN`, Verben eine Zeile in `DE_VERB`; Adjektive, Ortsangaben usw. nur, wenn das Deutsche vom Eintrag abweicht.
3. Mindestens eine Satzvorlage, in der das Wort vorkommt – meist in `js/data/actions.js` (`templates`). Liest die Engine eine Vorlage falsch, kommt ein handgeschriebener Rahmen in `FRAME_OVERRIDES` (`js/language.js`).
4. `node tools/check.js --fix` ausführen.

## Prüfen

```
node tools/check.js         # alle Prüfungen, ein paar Sekunden
node tools/check.js --fix   # erzeugt zusätzlich js/glyphs.js neu
```

Das Spiel läuft dabei ohne Browser (Node.js, ohne weitere Pakete) mit festem Zufallsstartwert. Geprüft wird unter anderem: Wortschatz vollständig und ohne Doppelungen, jeder Satz in allen Grammatikstufen sauber auf Japanisch und Deutsch, jedes lernbare Wort wird irgendwo gesagt, Beispielsätze bleiben gleich, ein simulierter Spieltag läuft fehlerfrei, Figuren finden über die Brücke, kein Zeitsprung nach einer Pause im Hintergrund, Speichern/Laden, Schrift-Teilmenge aktuell.
