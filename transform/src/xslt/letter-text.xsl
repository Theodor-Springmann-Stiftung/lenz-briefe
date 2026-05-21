<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="https://lenz-archiv.de"
  exclude-result-prefixes="tei">

  <xsl:import href="common.xsl" />
  <xsl:param name="letter" as="xs:string?" xmlns:xs="http://www.w3.org/2001/XMLSchema" />
  <xsl:param name="page" as="xs:string?" xmlns:xs="http://www.w3.org/2001/XMLSchema" />

  <xsl:template name="xsl:initial-template">
    <article class="letter-text" data-letter="{$letter}">
      <xsl:if test="$page">
        <xsl:attribute name="data-page" select="$page" />
      </xsl:if>
      <xsl:apply-templates select="/*/node()[not(self::tei:sidenote)]" />
    </article>
  </xsl:template>

</xsl:stylesheet>
