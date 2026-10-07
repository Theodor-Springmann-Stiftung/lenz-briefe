<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:lb="https://lenz-archiv.de"
  xmlns="http://www.tei-c.org/ns/1.0" exclude-result-prefixes="xs lb">
  <xsl:output method="xml" encoding="UTF-8" indent="yes"/>
  <!-- All inputs are supplied by the XML exporter; no network or enrichment reads. -->
  <xsl:param name="references" as="xs:string" required="yes"/>
  <xsl:param name="updated" as="xs:string" required="yes"/>
  <xsl:param name="base-url" as="xs:string" select="'https://lenz-briefe.de'"/>
  <xsl:variable name="defs" select="parse-xml($references)"/>
  <xsl:variable name="source-id" select="'b87dc1b2-5bd7-4ac8-a93e-7808334cf492'"/>
  <xsl:template name="xsl:initial-template">
    <TEI>
      <teiHeader>
        <fileDesc>
          <titleStmt>
            <title>Jakob Michael Reinhold Lenz: Kritische Briefausgabe – Briefverzeichnis</title>
            <editor>Jakob Lenz Archiv<email>lenz-archiv@tss-hd.de</email></editor>
          </titleStmt>
          <publicationStmt>
            <publisher><ref target="https://theodor-springmann-stiftung.de">Theodor Springmann Stiftung</ref></publisher>
            <idno type="url"><xsl:value-of select="$base-url || '/CMIF.xml'"/></idno>
            <date when="{$updated}"/>
            <availability><licence target="https://creativecommons.org/licenses/by/4.0/">This file is licensed under the terms of the Creative Commons License CC-BY 4.0</licence></availability>
          </publicationStmt>
          <sourceDesc><bibl type="online" xml:id="{$source-id}">Jakob Michael Reinhold Lenz: Kritische Briefausgabe, hrsg. v. Gregor Babelotzky (Heidelberg 2026ff). <ref target="{$base-url}/"><xsl:value-of select="$base-url"/></ref></bibl></sourceDesc>
        </fileDesc>
        <profileDesc>
          <xsl:for-each select="/lb:opus/lb:descriptions/lb:letterDesc">
            <correspDesc key="{@letter}" ref="{$base-url}/briefe/{encode-for-uri(@letter)}/" source="#{$source-id}">
              <xsl:apply-templates select="lb:sent | lb:received"/>
              <xsl:if test="not(lb:sent)"><correspAction type="sent"><persName>Unbekannt</persName></correspAction></xsl:if>
              <xsl:if test="not(lb:received)"><correspAction type="received"><persName>Unbekannt</persName></correspAction></xsl:if>
            </correspDesc>
          </xsl:for-each>
        </profileDesc>
      </teiHeader>
      <text><body><p/></body></text>
    </TEI>
  </xsl:template>
  <xsl:template match="lb:sent | lb:received">
    <correspAction type="{local-name()}">
      <xsl:if test="not(lb:person)"><persName>Unbekannt</persName></xsl:if>
      <xsl:apply-templates select="lb:person | lb:location | lb:date"/>
    </correspAction>
  </xsl:template>
  <xsl:template match="lb:person | lb:location">
    <xsl:variable name="person" select="self::lb:person"/>
    <xsl:variable name="id" select="string(@ref)"/>
    <xsl:variable name="def" select="if ($person) then $defs//lb:personDef[@index=$id] else $defs//lb:locationDef[@index=$id]"/>
    <xsl:if test="not($def)"><xsl:message terminate="yes">Unresolved CMIF reference: <xsl:value-of select="$id"/></xsl:message></xsl:if>
    <xsl:variable name="uri" select="(($def/@geonames[normalize-space()], $def/@ref[normalize-space()])[1], $base-url || '/?group=all&amp;' || (if ($person) then 'person' else 'place') || '=' || encode-for-uri($id))[1]"/>
    <xsl:element name="{if ($person) then 'persName' else 'placeName'}" namespace="http://www.tei-c.org/ns/1.0">
      <xsl:attribute name="ref" select="$uri"/>
      <xsl:apply-templates select="@cert"/>
      <xsl:value-of select="if (not($person) and normalize-space(.) and not(lower-case(normalize-space(.)) = ('vmtl.', 'wahrscheinlich', 'oder'))) then normalize-space(.) else $def/@name"/>
    </xsl:element>
  </xsl:template>
  <xsl:template match="lb:date[not(@when | @from | @to | @notBefore | @notAfter)]"/>
  <xsl:template match="lb:date[@when | @from | @to | @notBefore | @notAfter]">
    <date>
      <xsl:for-each select="@when | @from | @to | @notBefore | @notAfter">
        <xsl:if test="not(string(.) castable as xs:date or string(.) castable as xs:gYearMonth or string(.) castable as xs:gYear) or not(matches(., '^\d{4}(-\d{2}(-\d{2})?)?$'))">
          <xsl:message terminate="yes">Invalid CMIF date: <xsl:value-of select="."/></xsl:message>
        </xsl:if>
        <xsl:copy/>
      </xsl:for-each>
      <xsl:apply-templates select="@cert"/>
      <xsl:value-of select="normalize-space(.)"/>
    </date>
  </xsl:template>
  <xsl:template match="@cert"><xsl:if test=". = 'low'"><xsl:attribute name="cert">low</xsl:attribute></xsl:if></xsl:template>
</xsl:stylesheet>
