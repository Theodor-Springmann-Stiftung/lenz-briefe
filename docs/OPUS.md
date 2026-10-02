# OPUS: XML-Referenz der Lenz-Briefedition

Stand: 28. September 2026. Diese Referenz beschreibt die Quell-XML-Dateien der
Lenz-Edition: alle 61 Elementnamen und alle 58 Kombinationen aus Element und
Attribut der sechs aktuellen XSD-Dateien, einschließlich geerbter Attribute.
Maßgeblich für zulässige Strukturen sind die XSDs; Hinweise zur Darstellung
beschreiben die aktuelle Website. Die frühere Hamann-Dokumentation in dieser
Datei wurde durch die Lenz-spezifische Beschreibung ersetzt.

## Dateien und Namensraum

| Datei | Pfad unter `opus` | Zweck | Schema |
| --- | --- | --- | --- |
| `briefe.xml` | `document/letterText` | Edierte Brieftexte | [briefe.xsd](../data/xsd/briefe.xsd) |
| `meta.xml` | `descriptions/letterDesc` | Sende- und Empfangsdaten, Editionsgrundlage und Status | [meta.xsd](../data/xsd/meta.xsd) |
| `references.xml` | `definitions` | Personen, Orte, Apparatskategorien und Jahresgruppen | [references.xsd](../data/xsd/references.xsd) |
| `traditions.xml` | `traditions/letterTradition` | Überlieferungsangaben, Textkritik und weitere Apparate | [traditions.xsd](../data/xsd/traditions.xsd) |

[common.xsd](../data/xsd/common.xsd) definiert gemeinsame Metadaten-, Datums- und
Verweistypen. [textelements.xsd](../data/xsd/textelements.xsd) definiert die
Textauszeichnungen. Diese beiden Dateien sind eingebundene Schemabausteine.

Alle vier XML-Dateien verwenden das Wurzelelement `opus` und den Namensraum
`https://lenz-archiv.de`. Beispiel eines vollständigen Brieftext-Dokuments:

```xml
<?xml version="1.0" encoding="utf-8"?>
<opus xmlns="https://lenz-archiv.de"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="https://lenz-archiv.de ../xsd/briefe.xsd">
  <document>
    <letterText letter="199">
      <page index="1"/>
      <line/><align pos="center">Sachen die hier bleiben</align>
      <vspace lines="1.5"/>
      <line/>Regenschirm
    </letterText>
  </document>
</opus>
```

`xmlns` bestimmt den Namensraum der Elemente; `xmlns:xsi` deklariert den Präfix
für Schemahinweise. `xsi:schemaLocation` nennt paarweise Namensraum und zugehörige
XSD-Datei. Für die anderen Dokumente ist der Dateiname entsprechend anzupassen.
Diese XML-/Schemaangaben sind keine editionsspezifischen Attribute von `opus`.

### Schreibweisen und Grundregeln

- Groß-/Kleinschreibung ist relevant: `letterText`, `isProofread`, `notBefore`.
- `element/@attribut` bezeichnet ein Attribut des genannten Elements. „Pflicht“
  bedeutet: Das Attribut muss vorhanden sein. „Standard“ gilt bei fehlender Angabe.
- **Positive Ganzzahl:** `1`, `2`, …; **nichtnegative Ganzzahl:** `0`, `1`, …;
  **Ganzzahl:** auch negative Werte, etwa die Personen-ID `-1` für „Unbekannt“.
- **Boolean:** `true` und `false`; XML Schema erlaubt außerdem `1` und `0`.
- **Nichtleere Zeichenfolge:** mindestens ein Zeichen; **Text:** `xs:string`.
  „URI“ bezeichnet den Schematyp `xs:anyURI`.
- Leere Marken wie `<page/>`, `<line/>` und `<vspace/>` enthalten keinen Text.
  Normale XML-Zeilenumbrüche erzeugen keine semantischen Zeilenumbrüche auf der Website.
- Text und Auszeichnungen müssen in ihrer Quellreihenfolge erhalten bleiben.
  Elemente dürfen nicht beliebig verschachtelt oder umsortiert werden; siehe
  [Verschachtelung](#verschachtelung-und-erlaubte-inhalte).
- Generierte HTML-Attribute wie `class`, `style`, `data-origin`, `data-type` oder
  `data-sidenote-id` gehören nicht in die Quell-XML-Dateien.

## Brieftexte: `briefe.xml`

| Element | Inhalt und Bedeutung |
| --- | --- |
| `opus` | Genau ein `document`. |
| `document` | Mindestens ein `letterText`. |
| `letterText` | Gemischter Brieftext mit Auszeichnungen; als erstes Kindelement genau eine `page`-Marke, danach weitere Text- und Layoutauszeichnungen. |

| Attribut | Pflicht / Standard | Bedeutung |
| --- | --- | --- |
| `letterText/@letter` | Pflicht; nichtnegative Ganzzahl | Brief-ID; innerhalb von `document` eindeutig. Verknüpft Text, Metadaten und Überlieferungsangaben. |

Der Brief ist ein kontinuierlicher Textstrom. `page` und `line` sind Marken,
keine Container. Eine neue Seite kann mitten im Satz oder Wort beginnen.
Formatierungen und Hände können mehrere logische Zeilen umfassen; der Export
öffnet die Auszeichnung in den einzelnen HTML-Blöcken erneut.

## Metadaten: `meta.xml`

| Element | Inhalt und Bedeutung |
| --- | --- |
| `descriptions` | Container für null oder mehr `letterDesc`. |
| `letterDesc` | Metadaten eines Briefes. Reihenfolge: beliebig viele `sent`/`received`, dann genau ein `traditions`, ein `isProofread` und ein `isDraft`. |
| `sent` | Sendeereignis; null oder mehr `date`, `location`, `person` in beliebiger Reihenfolge, jeweils wiederholbar. |
| `received` | Empfangsereignis; dieselben Inhalte wie `sent`. |
| `date` | Menschenlesbare Datierung als Text; kann `wwwlink` enthalten. Maschinenlesbare Angaben stehen in Attributen. |
| `person` | Personenverweis; optional erläuternder Text und `wwwlink`. Absender/Empfänger ergibt sich aus `sent`/`received`. |
| `location` | Ortsverweis; optional erläuternder Text und `wwwlink`. |
| `traditions` | Innerhalb von `letterDesc`: mindestens ein `tradition` als Grundlage des edierten Textes, nicht als Liste sämtlicher bekannter Textzeugen. |
| `tradition` | Leerer Eintrag einer Editionsgrundlage. Bibliographische Details stehen in `traditions.xml`. |
| `isProofread` | Ob der Text anhand der besten verfügbaren Quelle kritisch geprüft wurde; optional erläuternder Text und `wwwlink`. |
| `isDraft` | Ob es sich um einen Entwurf handelt; optional erläuternder Text und `wwwlink`. |

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `letterDesc/@letter` | Pflicht; nichtnegative Ganzzahl | Brief-ID; innerhalb von `descriptions` eindeutig. |
| `tradition/@isOriginal` | Pflicht; Boolean | Editionsgrundlage ist ein Original. |
| `tradition/@type` | Pflicht | `manuscript` (auch Abschrift), `print`, `unknown`. |
| `isProofread/@value` | Pflicht; Boolean | Kritisch geprüft. Das Element ist weiterhin in Gebrauch. |
| `isDraft/@value` | Pflicht; Boolean | Entwurf. |

### Datumsattribute

Alle Datumsattribute sind optional. Der Wortlaut im Element bleibt unabhängig
von den maschinenlesbaren Angaben erhalten.

| Attribut | Bedeutung / Standard |
| --- | --- |
| `date/@when` | Einzelnes Datum. |
| `date/@notBefore` | Frühestmögliche Datierung. |
| `date/@notAfter` | Spätestmögliche Datierung. |
| `date/@from` | Beginn eines Zeitraums. |
| `date/@to` | Ende eines Zeitraums. |
| `date/@cert` | Sicherheit: `high` (Standard) oder `low`. |

Für `when`, `notBefore`, `notAfter`, `from` und `to` erlaubt das XSD die Typen
`xs:date`, `xs:gYear`, `xs:gMonth`, `xs:gDay`, `xs:gYearMonth` und `xs:gMonthDay`.
Beispiele: `1776-07-01`, `1776`, `--07`, `---01`, `1776-07`, `--07-01`.

Die Website leitet die chronologische Sortierung aus den Sendeereignissen ab:
pro Datum aus der ersten vorhandenen Angabe in der Reihenfolge `when`, `from`,
`notBefore`, `to`, `notAfter`; über die Ereignisse hinweg gilt der früheste
geeignete Kandidat. Die Anzeige verwendet weiterhin den Datierungstext.

### Personen- und Ortsverweise

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `person/@ref` | Pflicht; Ganzzahl | Verweis auf `personDef/@index`. |
| `location/@ref` | Pflicht; Ganzzahl | Verweis auf `locationDef/@index`. |
| `person/@erschlossen`, `location/@erschlossen` | Optional; `false` | Boolean: Zuordnung wurde erschlossen. |
| `person/@cert`, `location/@cert` | Optional; `high` | Sicherheit: `high` oder `low`. |
| `person/@kat` | Optional; `autor` | `autor`, `herausgeber`, `übersetzer`, `verleger`, `drucker`, `vertrieb`, `erwähnung`, `nachruf`. |
| `location/@kat` | Optional; `entstehungsort` | Einziger zulässiger Wert: `entstehungsort`. |

Beispiel eines vollständigen Metadaten-Dokuments:

```xml
<opus xmlns="https://lenz-archiv.de">
  <descriptions>
    <letterDesc letter="199">
      <sent>
        <date when="1776" cert="low">Wahrscheinlich 1776</date>
        <person ref="1"/>
      </sent>
      <received>
        <person ref="-1" erschlossen="true" cert="low"/>
        <location ref="1"/>
      </received>
      <traditions>
        <tradition isOriginal="true" type="manuscript"/>
      </traditions>
      <isProofread value="true"/>
      <isDraft value="false"/>
    </letterDesc>
  </descriptions>
</opus>
```

## Verzeichnisse: `references.xml`

`definitions` enthält genau je einen der folgenden Container in dieser
Reihenfolge: `personDefs`, `locationDefs`, `appDefs`, `yearGroups`.

| Container | Eintrag | Inhalt und Bedeutung |
| --- | --- | --- |
| `personDefs` | `personDef` | Null oder mehr Personen; Einträge sind leer und tragen ihre Angaben als Attribute. |
| `locationDefs` | `locationDef` | Null oder mehr Orte; leere Einträge. |
| `appDefs` | `appDef` | Null oder mehr Apparatsdefinitionen; leere Einträge. |
| `yearGroups` | `yearGroup` | Mindestens eine Jahresgruppe für die Navigation; leere Einträge. XML-Reihenfolge bestimmt die Anzeigereihenfolge. |

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `personDef/@index` | Pflicht; Ganzzahl | Eindeutige Personen-ID. |
| `personDef/@name` | Pflicht; nichtleer | Anzeigename. |
| `personDef/@nachname` | Optional; nichtleer | Nachname; kein Pflichtfeld. |
| `personDef/@vorname` | Optional; nichtleer | Vorname. |
| `personDef/@komm` | Optional; nichtleer | Kennung für einen zugehörigen Register-/Kommentareintrag; im aktuellen Schema kein eigenes Kommentarregister. |
| `personDef/@ref` | Optional; URI | Normdaten-URL, üblicherweise GND; vorhandene Werte müssen innerhalb des Personenverzeichnisses eindeutig sein. |
| `locationDef/@index` | Pflicht; Ganzzahl | Eindeutige Orts-ID. |
| `locationDef/@name` | Pflicht; nichtleer | Ortsname. |
| `locationDef/@ref` | Optional; URI | Normdaten-URL, üblicherweise GeoNames; vorhandene Werte müssen innerhalb des Ortsverzeichnisses eindeutig sein. |
| `appDef/@index` | Pflicht; Ganzzahl | Eindeutige Apparats-ID. |
| `appDef/@name` | Pflicht; Text | Bezeichnung des Apparats. |
| `appDef/@category` | Pflicht; nichtleer | Kategorie zur Gruppierung. |
| `yearGroup/@fromYear` | Pflicht; positive Ganzzahl | Erstes Jahr einschließlich; innerhalb von `yearGroups` eindeutig. |
| `yearGroup/@toYear` | Pflicht; positive Ganzzahl | Letztes Jahr einschließlich. |
| `yearGroup/@label` | Pflicht; nichtleer | Bezeichnung der Phase. |

Zusätzlich zur XSD-Prüfung lehnt der Export umgekehrte und überlappende
Jahresbereiche ab. Beispiel:

```xml
<opus xmlns="https://lenz-archiv.de">
  <definitions>
    <personDefs>
      <personDef index="1" name="Jakob Michael Reinhold Lenz"
                 vorname="Jakob Michael Reinhold" nachname="Lenz"/>
      <personDef index="-1" name="Unbekannt"/>
    </personDefs>
    <locationDefs>
      <locationDef index="1" name="Dorpat (Tartu)"/>
    </locationDefs>
    <appDefs>
      <appDef index="4" name="Handschrift" category="Überlieferung"/>
    </appDefs>
    <yearGroups>
      <yearGroup fromYear="1765" toYear="1769" label="Frühe Briefe"/>
      <yearGroup fromYear="1770" toYear="1776" label="Weitere Briefe"/>
    </yearGroups>
  </definitions>
</opus>
```

## Überlieferung und Apparate: `traditions.xml`

| Element | Inhalt und Bedeutung |
| --- | --- |
| `traditions` | Direkt unter `opus`: null oder mehr `letterTradition`. Nicht mit dem gleichnamigen Metadaten-Container verwechseln. |
| `letterTradition` | Null oder mehr `app`; auch Text zwischen den Apparaten ist zulässig und bleibt erhalten. |
| `app` | Gemischter Text mit den gemeinsamen Textauszeichnungen und zusätzlichen `page`-Marken. |

| Attribut | Pflicht / Standard | Bedeutung |
| --- | --- | --- |
| `letterTradition/@letter` | Pflicht; nichtnegative Ganzzahl | Verweis auf den zugehörigen Brief. |
| `app/@ref` | Pflicht; nichtnegative Ganzzahl | Verweis auf `appDef/@index`; Name und Kategorie kommen aus der Definition. |

```xml
<opus xmlns="https://lenz-archiv.de">
  <traditions>
    <letterTradition letter="199">
      <app ref="4">Archivangabe. <line/>Weitere Angaben zur Handschrift.</app>
    </letterTradition>
  </traditions>
</opus>
```

Es gibt keine zusätzlichen Quellcontainer `ZHText` oder `text` innerhalb von
`app`. Der Apparat enthält seinen Text direkt. Seine HTML-Seitenanker erhalten
andere IDs als die Seitenanker des Brieftexts.

## Textfluss, Seiten und Ausrichtung

| Element | Bedeutung |
| --- | --- |
| `page` | Leere Marke für den Beginn einer Quellseite; erzeugt keinen Absatz und keine zusätzliche Leerzeile. |
| `line` | Leere Marke für einen logischen Zeilenbeginn oder ein Linienornament. Automatischer Bildschirmumbruch bleibt möglich. |
| `vspace` | Leere Marke für zusätzlichen vertikalen Abstand in Zeilenhöhen. |
| `align` | Ausgerichteter Inhalt innerhalb einer logischen Zeile. |

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `page/@index` | Pflicht; positive Ganzzahl | Innerhalb des Briefes eindeutige Seiten-ID; Ziel für `sidenote/@page`. |
| `page/@type` | Optional; `inner` | `inner` oder `outer`; bleibt als Information erhalten, ohne Seitenidentität oder aktuelle Gestaltung zu ändern. |
| `line/@type` | Optional; `break` | `break`: neue Zeile; `line`: horizontale Linie; `tilde`: geschwungener Strich; `double-tilde`: doppelter geschwungener Strich. |
| `line/@tab` | Optional; positive Ganzzahl | Einzug der ersten dargestellten Zeile. Eine Einheit entspricht derzeit `2ch`; automatisch umgebrochene Folgezeilen bleiben links. Auf schmalen Bildschirmen ist der Einzug begrenzt. |
| `vspace/@lines` | Pflicht; Dezimalzahl größer als null | Abstand: z. B. `1`, `0.5`, `1.5`. Dezimalpunkt verwenden; kein Komma, Exponent, Null oder negativer Wert. |
| `vspace/@presentational` | Optional; `false` | Boolean: Abstand zur Verständnishilfe statt einer nachgebildeten Lücke der Quelle. Die Höhe bleibt gleich; die Legende unterscheidet diese Abstände. |
| `align/@pos` | Pflicht | `left`, `center` oder `right`. |

`vspace` beendet die bisherige Zeile und setzt den Einzug zurück. Ein unmittelbar
folgendes `<line/>` erzeugt keine zusätzliche Leerzeile; zwei aufeinanderfolgende
`<line/>` erzeugen eine leere logische Zeile. Ein normales `line` ohne `tab`
setzt den bisherigen Einzug ebenfalls zurück. Die horizontale Linie hat nur
kleinen eigenen Abstand; größere Abstände werden mit `vspace` ausgezeichnet.

Ein Seitenwechsel innerhalb eines Textblocks wird auf der Website mit einem
vertikalen Strich markiert; an einer Blockgrenze bleibt nur der Seitenanker.
Beispiel: `ohne-<page index="3"/>dem`. Das ist kein Anlass für einen Absatz.

## Transformierter Text

`tr` umschließt einen transformierten Textblock und ist überall zulässig, wo
`ul` erlaubt ist. Das Pflichtattribut `rot` gibt die Drehung im Uhrzeigersinn
in Grad an; erlaubt sind Zahlen von 0 bis einschließlich 359, auch Dezimalwerte.
Der Block darf Text und die gemeinsame Textauszeichnungsgruppe enthalten,
einschließlich Zeilenwechseln und Ausrichtung.

```xml
<sidenote page="1" pos="left" annotation="am linken Rand, vertikal">
  <tr rot="270">Randtext.<line/>Weitere Zeile.</tr>
</sidenote>
```

0 bedeutet keine Drehung, 90 eine Vierteldrehung im Uhrzeigersinn, 180 eine
halbe Drehung und 270 eine Vierteldrehung gegen den Uhrzeigersinn. Bei der
Übernahme der geprüften Randnotizen bleiben Notizen ohne Drehung (0) oder ohne
zugeordnetes Ergebnis unverändert; sonst wird ihr gesamter Inhalt umschlossen.

## Randnotizen und Hände

| Element | Bedeutung |
| --- | --- |
| `sidenote` | Text am Rand der Quelle mit eigenem Textfluss, eigenen Zeilen und Auszeichnungen. |
| `hand` | Text einer bestimmten schreibenden Person; kann nur einzelne Wörter oder einen mehrzeiligen Bereich umfassen. |

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `sidenote/@page` | Pflicht; positive Ganzzahl | Zugehörige Quellseite, unabhängig von der XML-Position der Notiz. |
| `sidenote/@pos` | Pflicht | Ursprüngliche Position: `left`, `right`, `top`, `bottom`, `top right`, `top left`, `bottom right`, `bottom left`. |
| `sidenote/@annotation` | Optional; Text | Erläuterung, etwa „am linken Rand, vertikal“; unter der Notiz angezeigt. |
| `sidenote/@type` | Optional; kein Attribut für normale Randnotizen | Einziger expliziter Wert: `inpos`. Zeigt die Notiz als Block an ihrer XML-Position, mit Positionssymbol links; keine zusätzliche Randplatzierung. |
| `hand/@ref` | Pflicht; positive Ganzzahl | Verweis auf `personDef/@index`, nicht auf ein eigenes Hände-Verzeichnis. |

Normale Randnotizen werden separat exportiert und auf breiten Bildschirmen im
rechten Rand bei ihrer Quellseite angeordnet. Das Symbol gibt die ursprüngliche
Position an, auch wenn diese links, oben oder unten war. Auf schmalen Bildschirmen
folgen diese Notizen dem Brieftext. Nicht zuordenbare Notizen bleiben erhalten
und werden als fehlende Seitenzuordnung gemeldet. `type="inpos"` bleibt dagegen
an seiner Textposition; `page` und `pos` sind auch dann erforderlich.

Eine `hand` darf Seitenmarken und Randnotizen enthalten. Die ausgelagerte Notiz
erbt die nächste umschließende Hand. Handschriften werden auf der Website
unterschieden; beim Berühren oder Fokussieren eines Namens werden Inline-Stellen
gezielt, ganze Passagen flächig und Tabellenstellen innerhalb ihrer Zelle markiert.

```xml
<hand ref="25">
  <line/>Text dieser Hand.
  <sidenote page="1" pos="left" annotation="am linken Rand, vertikal">
    Randnotiz derselben Hand.<line/>Zweite Zeile.
  </sidenote>
  <line/>Fortsetzung.
</hand>
<sidenote type="inpos" page="1" pos="top">
  Diese Notiz steht genau hier als Block.
</sidenote>
```

## Tabellen und Spalten

| Element | Bedeutung |
| --- | --- |
| `tabs` | Zusammengehörige Spalten und Zeilen. |
| `tab` | Einzelner Spaltenbereich; darf mehrere Zeilen, Abstände und verschachtelte `tabs` enthalten. |

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `tabs/@extent` | Optional; positive Ganzzahl | Umfangsangabe, die als `data-extent` erhalten bleibt. Bestimmt derzeit weder die Spaltenzahl noch die Breite; dafür gilt `tab/@value`. |
| `tab/@value` | Pflicht | `i-n` mit `2 ≤ n ≤ 12` und `1 ≤ i ≤ n`. Alle Kombinationen dieser Grenzen sind im Schema aufgeführt. |
| `tab/@type` | Optional; ohne Attribut keine Begrenzung | Linien- oder Klammerauszeichnung gemäß folgender Tabelle. |

**Die Position beginnt bei `(i−1)/n`, nicht bei `i/n`.** `1-2` beginnt links,
`2-2` in der Mitte. `1-3`, `2-3`, `3-3` ergeben drei Drittel; `0-3` ist ungültig.
Eine Zelle reicht bis zum nächsten weiter rechts liegenden Tabstopp bzw. bis
zum Zeilenende. Gleiche oder zurückspringende Positionen umbrechen in eine neue
Zeile. Text zwischen Zellen gehört zur vorangehenden Zelle; Text vor der ersten
Zelle steht in einem eigenen Bereich über die ganze Breite.

Ein `<line/>` zwischen Zellen beginnt eine neue Tabellenzeile; innerhalb einer
Zelle beginnt es nur eine neue Zeile dieser Zelle. Zellen sind oben ausgerichtet,
damit ein führendes `vspace` nur die betreffende Spalte beeinflusst. Verschachtelte
Tabellen beziehen ihre Breiten auf die umschließende Zelle. Die Website realisiert
die Spalten mit HTML-Blöcken und CSS, ohne JavaScript für die Tabellenanordnung.

| `tab/@type` | Darstellung |
| --- | --- |
| `line-left` | Gerade vertikale Linie links. |
| `line-right` | Gerade vertikale Linie rechts. |
| `line` | Alias für `line-right`. |
| `left-virgil-inwards` | `}` links; Spitze zeigt zum Zellentext. |
| `right-virgil-inwards` | `{` rechts; Spitze zeigt zum Zellentext. |
| `left-virgil-outwards` | `{` links; Spitze zeigt vom Zellentext weg. |
| `right-virgil-outwards` | `}` rechts; Spitze zeigt vom Zellentext weg. |

Die Begrenzung erstreckt sich über die Höhe der betreffenden Zelle, nicht
zwangsläufig über die Höhe ihrer Nachbarzelle. Sie fügt keine Zeichen zum
kopierten oder durchsuchten Text hinzu. Pro Zelle wird genau ein Typ angegeben.

```xml
<tabs>
  <tab value="1-2" type="right-virgil-inwards">
    <line/>Regenschirm
    <line/>Instruktion des Königs
    <line/>Ray de St. Genie
  </tab>
  <tab value="2-2">
    <vspace lines="1.5"/>
    <line/>schickst Du an Mühlgau.
    <tabs>
      <tab value="1-2" type="line-right">Unterspalte links</tab>
      <tab value="2-2">Unterspalte rechts</tab>
    </tabs>
  </tab>
</tabs>
```

## Weitere Textauszeichnungen

Die folgende Tabelle enthält auch Elemente ohne Attribute. Sofern nicht anders
angegeben, erlauben sie gemischten Text mit den gemeinsamen Textauszeichnungen.

| Element | Bedeutung / aktuelle Darstellung |
| --- | --- |
| `aq` | Lateinische Schrift; serifenlos, leicht vergrößert; der Export setzt derzeit zusätzlich `lang="la"`. |
| `b` | Fettdruck. |
| `it` | Kursivdruck. |
| `large` | Größer geschriebener Text. |
| `sup` | Hochgestellter Text. |
| `sub` | Tiefgestellter Text. |
| `ul` | Einfache Unterstreichung. |
| `dul` | Doppelte Unterstreichung. |
| `tul` | Dreifache Unterstreichung. |
| `highlight` | Farbige Hervorhebung. |
| `del` | Durchgestrichener Text; verschachtelte `del` werden doppelt durchgestrichen. |
| `er` | Tilgung; lesbarer Text erscheint invers, ohne lesbaren Text bleibt ein dunkler Balken. |
| `insertion` | Nachträgliche Einfügung, zwischen kleinen Winkeln; Positionsangaben können einen Pfeil ergänzen. |
| `subst` | Überschreibung/Ersetzung: ursprünglicher und eingesetzter Text bleiben sichtbar. Ein kleines Quadrat kennzeichnet die Überschreibung. |
| `undo` | Rücknahme einer Auszeichnung, durch gepunktete Unterstreichung markiert. |
| `ink` | Mit Tinte geschriebener Text; im Brieftext dunkelblau. |
| `pe` | Bleistift; im Brieftext grau. |
| `note` | Editorische Anmerkung in eckigen Klammern; im Brieftext grau, alleinstehend zentriert. |
| `tl` | Textverlust; gepunkteter Kreis als Kennzeichnung. |
| `nr` | Unentzifferte Stelle; bei `extent="1"` ein umgekehrtes Fragezeichen (¿), bei größerem Umfang zwei umgekehrte Fragezeichen mit entsprechendem Abstand. Große leere Bereiche können auf der Website umbrechen. |
| `address` | Adresse; transparenter Container ohne eigene Gestaltung. |
| `fn` | Fußnotenstelle oder Fußnotentext im Textfluss; Zuordnung über `index`. |
| `anchor` | Verweiszeichen innerhalb des Textes, ohne eigenes Attribut und ohne automatische Hochstellung. |
| `gr` | Altgriechisch; `lang="grc"`. |
| `fr` | Französisch; `lang="fr"`. |
| `hb` | Hebräisch; `lang="he"`. |
| `ru` | Russisch; `lang="ru"`. |

Sprachkennzeichnungen außer `aq` verändern nicht zusätzlich die Schrift.
Im Apparatsbereich verwendet die Website einheitliche Textfarben.

| Attribut | Pflicht / Standard | Bedeutung / Werte |
| --- | --- | --- |
| `highlight/@color` | Pflicht | Nur `yellow` oder `red`, keine beliebigen CSS-Farben. |
| `insertion/@pos` | Optional | Dieselben acht Positionswerte wie `sidenote/@pos`. |
| `insertion/@annotation` | Optional; Text | Erläuterung; im HTML als Datenattribut erhalten. |
| `nr/@extent` | Optional; `1` | Positive Ganzzahl: ungefährer Umfang in Zeichenbreiten. |
| `fn/@index` | Pflicht; positive Ganzzahl | Kennung zusammengehöriger Fußnotenstellen; keine globale eindeutige ID. |

`subst` muss zuerst mindestens ein `del` und danach mindestens ein `insertion`
enthalten; freier Text direkt in `subst` ist nicht erlaubt. `undo` enthält
mindestens eines der Elemente `del`, `ul`, `sup`, `sub`, `tul`, `dul`, ebenfalls
keinen freien Text direkt im Container.

```xml
<subst><del>alt</del><insertion>neu</insertion></subst>
<undo><del>wieder gültig</del></undo>
<insertion pos="top" annotation="über der Zeile">Zusatz</insertion>
<nr extent="4"/>
<highlight color="yellow">hervorgehoben</highlight>
<fn index="1"><anchor><sup>1</sup></anchor></fn>
```

`anchor` besitzt kein `ref`-Attribut. Hochstellung wird ausdrücklich mit `sup`
ausgezeichnet. Die Website verbindet genau zwei eindeutig zuordenbare
`fn`-Vorkommen mit demselben `index` innerhalb eines Briefes; wiederholte,
mehrdeutige Kennungen werden nicht geraten. Eine Fußnote wird durch `fn` allein
nicht automatisch an den Seitenfuß verschoben.

## Externe Links in Metadaten

| Element / Attribut | Pflicht / Standard | Bedeutung |
| --- | --- | --- |
| `wwwlink` | Text mit weiteren `wwwlink` laut gemeinsamem Schematyp | Externer Link innerhalb der Metadaten-Texttypen. Links beim Bearbeiten nicht ineinander verschachteln. |
| `wwwlink/@address` | Pflicht; URI | Zieladresse; die Website verlinkt `http://` und `https://`. |

`wwwlink` ist in `date`, `person`, `location`, `isProofread` und `isDraft`
zulässig. Es gehört nicht zur Gruppe der Brieftextauszeichnungen und ist daher
nicht direkt in `letterText`, `app` oder gewöhnlichen Textauszeichnungen erlaubt.

```xml
<isProofread value="true">
  Geprüft anhand des <wwwlink address="https://example.org/quelle">Digitalisats</wwwlink>.
</isProofread>
```

## Verschachtelung und erlaubte Inhalte

Die XSD-Gruppe `inlineElements` enthält genau diese Elemente (die Bezeichnung
„inline“ bedeutet hier nicht, dass die spätere HTML-Darstellung immer inline ist):

`line`, `vspace`, `align`, `aq`, `ul`, `tr`, `sup`, `sub`, `tul`, `highlight`, `undo`,
`address`, `insertion`, `del`, `hand`, `note`, `tl`, `dul`, `fn`, `pe`, `anchor`,
`nr`, `b`, `it`, `gr`, `fr`, `hb`, `subst`, `tabs`, `er`, `ink`, `large`, `ru`.

| Kontext | Direkt erlaubte Inhalte |
| --- | --- |
| `letterText` | Text, die gemeinsame Gruppe, `page`, `sidenote`; erste Elementposition muss `page` sein. |
| `hand` | Text, die gemeinsame Gruppe, `page`, `sidenote`. |
| `tabs` | Text, die gemeinsame Gruppe, `tab`, `page`. |
| `tab`, `sidenote` und gewöhnliche Textauszeichnungen | Text und die gemeinsame Gruppe. `page`, `sidenote` oder einzelne `tab` sind hier nicht direkt zusätzlich erlaubt. |
| `app` | Text, die gemeinsame Gruppe und `page`. |
| `align` | Text und die gemeinsame Gruppe außer direkten `line`, `vspace` und `undo`. Zeilenwechsel gegebenenfalls außerhalb von `align` setzen. |
| `subst` | Mindestens ein `del`, gefolgt von mindestens einem `insertion`. |
| `undo` | Mindestens ein `del`, `ul`, `tr`, `sup`, `sub`, `tul` oder `dul`. |
| `page`, `line`, `vspace` | Leer. |
| `date`, `person`, `location`, `isProofread`, `isDraft` | Text und `wwwlink`; keine allgemeine Brieftextformatierung. |

Die Regeln gelten jeweils für direkte Kinder. Beispielsweise kann eine in einer
Zelle enthaltene `hand` wiederum `sidenote` enthalten. Die normale Verwendung
von Randnotizen ist im Brieftext; ihre Platzierung verarbeitet der Briefexport.
SVG-Einbettungen sind derzeit nicht Bestandteil des Schemas.

## Frühere, hier nicht unterstützte Strukturen

Folgende Angaben aus der früheren Dokumentation sind keine gültige Beschreibung
der aktuellen Lenz-Quellen:

- Kommentar-/Editionscontainer `data`, `kommentare`, `kommcat`, `kommentar`,
  `lemma`, `titel`, `subsection`, `eintrag`, `edits`, `editreason`, `edit`, `zh`,
  `marginalien`, `marginal`, `bzg` und die zugehörigen Dateien.
- Verzeichnisse `structureDefs`, `sourceDefs`, `handDefs`, `handDef`.
- Metadaten `sort`, `senders`, `sender`, `receivers`, `receiver`, `hasOriginal`,
  `ZHInfo`, `dateChanged`, `begin`, `alternativeLineNumbering`. `hasOriginal`
  existiert nur als abgeleitete Exportinformation, nicht als aktueller XML-Tag.
- Textauszeichnungen `added`, `ful`, `super`, `sal`, `datum`, `ps`, `sig`,
  `ZHText`, `text`, `link` und `intlink`. Für Hochstellung gilt `sup`.
- Attribute `align/@value`, `anchor/@ref`, `date/@value`, `line/@index`,
  `line/@autopsic`, `page/@autopsic` sowie `line type="empty"`.
  Stattdessen gelten `align/@pos`, die Datumsattribute oben und `vspace`.

## Prüfung und weiterführende Dokumentation

Alle vier Quelldokumente gegen ihre XSDs prüfen (vom Repository-Stamm aus):

```sh
uv run --project scripts/transform/python python -m transform_python.validate_schemas
```

Weitere technische Details: [Python-Export](../scripts/transform/python/README.md)
und [Website](../app/README.md).
