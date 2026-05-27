<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  exclude-result-prefixes="lb">

  <xsl:import href="common.xsl" />

  <xsl:template name="xsl:initial-template">
    <xsl:call-template name="lb:render-flow">
      <xsl:with-param name="nodes" select="/*/node()" />
    </xsl:call-template>
  </xsl:template>

</xsl:stylesheet>
