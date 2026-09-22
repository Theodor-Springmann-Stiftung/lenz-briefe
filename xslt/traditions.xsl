<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="lb xs">

  <xsl:import href="common.xsl" />
  <xsl:output indent="no" />
  <xsl:param name="letter" as="xs:string?" />
  <xsl:param name="appDefinitions" as="xs:string" select="'{}'" />
  <xsl:variable name="app-definitions" select="parse-json($appDefinitions)" />

  <xsl:function name="lb:app-category" as="xs:string">
    <xsl:param name="node" as="node()" />
    <xsl:sequence select="
      if ($node/self::*[local-name()='app'])
      then string(($app-definitions(string($node/@ref))?category[normalize-space()], 'Weitere Angaben')[1])
      else ''
    " />
  </xsl:function>

  <xsl:template name="xsl:initial-template">
    <section class="traditions" data-letter="{$letter}">
      <!-- Adjacent grouping preserves source order, including mixed text between entries. -->
      <xsl:for-each-group select="/*[local-name()='letterTradition']/node()[not(self::text()[not(normalize-space())])]"
        group-adjacent="lb:app-category(.)">
        <xsl:choose>
          <xsl:when test="current-grouping-key() != ''">
            <section class="tradition-category" data-category="{current-grouping-key()}">
              <h2 class="tradition-category-heading"><xsl:value-of select="current-grouping-key()" /></h2>
              <xsl:apply-templates select="current-group()" />
            </section>
          </xsl:when>
          <xsl:otherwise>
            <xsl:apply-templates select="current-group()" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:for-each-group>
    </section>
  </xsl:template>

  <xsl:template match="lb:app | *[local-name()='app']">
    <xsl:variable name="definition" select="$app-definitions(string(@ref))" />
    <xsl:variable name="name" select="string(($definition?name[normalize-space()], concat('Apparat ', @ref))[1])" />
    <div class="tradition-app" data-ref="{@ref}" data-name="{$name}">
      <xsl:if test="$name != lb:app-category(.)">
        <h3 class="tradition-app-heading"><xsl:value-of select="$name" /></h3>
      </xsl:if>
      <xsl:call-template name="lb:render-flow">
        <xsl:with-param name="nodes" select="node()" />
        <xsl:with-param name="page-id-prefix" select="concat('app-', count(preceding-sibling::*[local-name()='app']) + 1, '-page-')" />
      </xsl:call-template>
    </div>
  </xsl:template>

</xsl:stylesheet>
