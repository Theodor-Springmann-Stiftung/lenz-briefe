<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="tei xs">

  <xsl:import href="common.xsl" />
  <xsl:param name="letter" as="xs:string?" />
  <xsl:param name="page" as="xs:string" />

  <xsl:template name="xsl:initial-template">
    <xsl:for-each select="/tei:letterText/tei:sidenote[@page = $page]">
      <aside class="sidenote">
        <xsl:attribute name="data-letter" select="$letter" />
        <xsl:attribute name="data-page" select="@page" />
        <xsl:attribute name="data-pos" select="@pos" />
        <xsl:attribute name="data-annotation" select="@annotation" />
        <xsl:apply-templates />
      </aside>
    </xsl:for-each>
  </xsl:template>

</xsl:stylesheet>
