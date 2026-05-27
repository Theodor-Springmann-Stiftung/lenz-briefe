<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  exclude-result-prefixes="lb">

  <xsl:import href="common.xsl" />
  <xsl:param name="letter" as="xs:string?" xmlns:xs="http://www.w3.org/2001/XMLSchema" />

  <xsl:template name="xsl:initial-template">
    <section class="traditions" data-letter="{$letter}">
      <xsl:apply-templates select="/*[local-name()='letterTradition']/node()" />
    </section>
  </xsl:template>

  <xsl:template match="lb:app | *[local-name()='app']">
    <div class="tradition-app">
      <xsl:if test="@ref">
        <xsl:attribute name="data-ref" select="@ref" />
      </xsl:if>
      <xsl:call-template name="lb:render-flow">
        <xsl:with-param name="nodes" select="node()" />
      </xsl:call-template>
    </div>
  </xsl:template>

</xsl:stylesheet>
