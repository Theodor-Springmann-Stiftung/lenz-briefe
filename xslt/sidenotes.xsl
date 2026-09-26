<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="lb xs">

  <xsl:import href="common.xsl" />
  <xsl:param name="letter" as="xs:string?" />
  <xsl:param name="sidenoteId" as="xs:string?" />
  <xsl:param name="inheritedHand" as="xs:string" select="''" />

  <xsl:template name="xsl:initial-template">
    <xsl:variable name="nodes" as="node()*">
      <xsl:choose>
        <xsl:when test="$inheritedHand != ''">
          <lb:hand ref="{$inheritedHand}" data-origin="{concat($sidenoteId, '-inherited-hand')}">
            <xsl:sequence select="/*/node()" />
          </lb:hand>
        </xsl:when>
        <xsl:otherwise>
          <xsl:sequence select="/*/node()" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <aside class="sidenote">
      <xsl:if test="$sidenoteId">
        <xsl:attribute name="id" select="$sidenoteId" />
      </xsl:if>
      <xsl:attribute name="data-letter" select="$letter" />
      <xsl:attribute name="data-page" select="/*/@page" />
      <xsl:attribute name="data-pos" select="/*/@pos" />
      <xsl:attribute name="data-annotation" select="/*/@annotation" />
      <xsl:call-template name="lb:render-flow">
        <xsl:with-param name="nodes" select="$nodes" />
      </xsl:call-template>
    </aside>
  </xsl:template>

</xsl:stylesheet>
