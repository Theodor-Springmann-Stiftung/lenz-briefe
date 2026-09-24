<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="lb xs">

  <xsl:import href="common.xsl" />
  <xsl:param name="letter" as="xs:string?" />
  <xsl:param name="sidenoteId" as="xs:string?" />

  <xsl:template name="xsl:initial-template">
    <aside class="sidenote">
      <xsl:if test="$sidenoteId">
        <xsl:attribute name="id" select="$sidenoteId" />
      </xsl:if>
      <xsl:attribute name="data-letter" select="$letter" />
      <xsl:attribute name="data-page" select="/*/@page" />
      <xsl:attribute name="data-pos" select="/*/@pos" />
      <xsl:attribute name="data-annotation" select="/*/@annotation" />
      <xsl:call-template name="lb:render-flow">
        <xsl:with-param name="nodes" select="/*/node()" />
      </xsl:call-template>
    </aside>
  </xsl:template>

</xsl:stylesheet>
