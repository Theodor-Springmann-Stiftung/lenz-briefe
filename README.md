# Lenz-Briefedition

Dieses Repository enthält die Texte und Daten der kritischen Briefausgabe von Jakob Michael Reinhold Lenz sowie die Software für ihre digitale Veröffentlichung. Die Website wird aus den XML-Daten und den ergänzenden Seiten als statische Website erzeugt.

## Ordnerübersicht

| Ordner | Inhalt |
| --- | --- |
| [seiten/](seiten/) | Redaktionelle Begleitseiten und wiederverwendbare Textbausteine. |
| [data/](data/) | XML-Quelldaten, Regeln für deren Aufbau und Vorlagen zur Umwandlung in HTML. |
| [assets/](assets/) | Öffentlich bereitgestellte Dateien, etwa Bilder, das Website-Symbol und `robots.txt`. |
| [app/](app/) | Die Astro-Website mit Seitenvorlagen, Gestaltung und interaktiven Funktionen. Hinweise zur Entwicklung stehen in der [README der Website](app/README.md). |
| [scripts/](scripts/) | Hilfsprogramme zur Prüfung, Bearbeitung und Umwandlung der Editionsdaten. `scripts/tests/` enthält Tests für die Hilfsprogramme. |
| [docs/](docs/) | Dokumentation, insbesondere die [XML-Referenz](docs/OPUS.md), und offene redaktionelle Fragen. `docs/import/` enthält Ausgangsdokumente und Bildmaterial für die Übernahme von Inhalten. |
| [licenses/](licenses/) | Lizenztexte und Urheberrechtshinweise der verwendeten Software, Schriftarten und Icons. Eine Übersicht bietet die [Lizenz-README](licenses/README.md). Der gesamte Ordner wird beim Build mitveröffentlicht. |
| [.github/workflows/](.github/workflows/) | Automatische Prüfungen und die Veröffentlichung der Website über GitHub. |

## `seiten/`: Begleitseiten der Edition

Die Markdown-Dateien in diesem Ordner enthalten die redaktionellen Seiten der
Website. Angaben am Dateianfang legen unter anderem Titel, Menübezeichnung und
Reihenfolge fest.

| Datei oder Unterordner | Inhalt |
| --- | --- |
| [components/](seiten/components/) | Wiederverwendbare Inhalte, die in mehrere Seiten eingebunden werden können. `lkb-legende.html` enthält die Legende der Editionszeichen, `lkb-siglen.md` die gemeinsame Siglenliste. |

Bilder und Downloads liegen im Ordner `assets/` im Projektstamm. Die Seite „Lizenzen und Drittanbieter“ wird aus dem Lizenzverzeichnis erzeugt.

Die Seite „Materialien zu geplanten oder verschollenen Briefen“ bindet die direkt
bearbeitbaren HTML-Transkriptionen `seiten/components/lkb-briefumschlaege.html`,
`lkb-briefplaene.html` und `lkb-brieffragmente.html` ein. Sie verwenden dieselben
HTML-Auszeichnungen und CSS-Klassen wie die Edition (`edition-text`, `lb-line-block`,
`nr`, `tl`, `ul`, `del`, `pe`, `ink` und `note`). Die Transkriptionen stehen in
`blockquote`-Blöcken mit einer Randlinie; umschließende Zitatzeichen entfallen.
Die Siegelgalerie liegt in `seiten/components/lkb-siegel.md`, ihre WebP-Abbildungen
in `assets/siegel/`. Die Originalvorlagen bleiben in `docs/import/`.

## `data/`: Editionsdaten und Verarbeitungsregeln

### `data/xml/`

Hier liegen die bearbeitbaren Quelldaten der Edition. Die Dateien sind über
Briefnummern sowie Personen- und Ortskennungen miteinander verknüpft.

| Datei | Inhalt |
| --- | --- |
| `briefe.xml` | Edierte Brieftexte einschließlich Textauszeichnungen und editorischer Markierungen. |
| `meta.xml` | Angaben zu den Briefen, etwa Absender, Empfänger, Orte, Datierung, Editionsgrundlage und Bearbeitungsstatus. |
| `references.xml` | Gemeinsame Verzeichnisse für Personen, Orte, Apparatskategorien und Jahresgruppen. |
| `traditions.xml` | Überlieferungsnachweise, textkritische Angaben und weitere Apparate zu den Briefen. |

### `data/xsd/`

Die XML-Schemata legen fest, welche Elemente, Attribute und Strukturen in den
Quelldaten zulässig sind. 

### `data/dtd/`

Enthält mit `briefe.dtd` eine weitere Beschreibung der XML-Struktur. Für die aktuellen automatischen Prüfungen sind die Schemata in `data/xsd/` maßgeblich.

### `data/xslt/`

Die XSLT-Dateien bestimmen, wie die XML-Inhalte in HTML umgewandelt werden. `common.xsl` enthält die gemeinsamen Regeln. `letter-text.xsl` verarbeitet die Brieftexte, `sidenotes.xsl` die Randnotizen, `traditions.xsl` die Überlieferungsangaben und `app-body.xsl` die Inhalte der Apparate.

## `scripts/transform/`: Umwandlung für die Website

Die aktive Verarbeitung liegt in [scripts/transform/python/](scripts/transform/python/).
Sie liest die XML-Daten, prüft ihre Struktur und erzeugt mithilfe der XSLT-Dateien HTML-Fragmente sowie JSON-Dateien für die Website. Dazu gehören Brieftexte, Randnotizen, Überlieferungsangaben, der Briefkatalog und die Suchdaten.

Die erzeugten Editionsdateien landen in `app/generated/`, die fertige Website in `app/dist/`. Änderungen an Inhalten erfolgen in den Quelldateien; erzeugte Dateien werden beim nächsten Build neu geschrieben.

| Datei oder Unterordner | Inhalt |
| --- | --- |
| `python/README.md` | Ausführliche Beschreibung der Verarbeitung und ihrer Verwendung. |
| `python/src/transform_python/` | Der eigentliche Programmcode der Verarbeitung. |

## Lizenzen

Der eigene Anwendungscode steht unter der MIT-Lizenz, die redaktionellen Inhalte und XML-Daten unter CC BY 4.0, soweit nicht anders gekennzeichnet. Einzelheiten zum Geltungsbereich stehen in [LICENSE.md](LICENSE.md). Für Drittanbieter gelten die jeweiligen [Lizenztexte und Hinweise](licenses/README.md).
