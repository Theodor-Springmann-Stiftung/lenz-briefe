<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="https://lenz-archiv.de"
  exclude-result-prefixes="tei">

  <xsl:import href="common.xsl" />
  <xsl:param name="letter" as="xs:string?" xmlns:xs="http://www.w3.org/2001/XMLSchema" />

  <xsl:template name="xsl:initial-template">
    <section class="traditions" data-letter="{$letter}">
      <xsl:apply-templates select="/*[local-name()='letterTradition']/node()" />
    </section>
  </xsl:template>

  <xsl:template match="tei:app | *[local-name()='app']">
    <div class="tradition-app">
      <xsl:if test="@ref">
        <xsl:attribute name="data-ref" select="@ref" />
      </xsl:if>
      <xsl:apply-templates />
    </div>
  </xsl:template>

</xsl:stylesheet>
