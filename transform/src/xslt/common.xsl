<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="https://lenz-archiv.de"
  exclude-result-prefixes="tei">

  <xsl:output method="html" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:mode on-no-match="shallow-skip" />

  <xsl:template match="text()">
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="tei:page">
    <span class="lb-page" data-index="{@index}"></span>
  </xsl:template>

  <xsl:template match="tei:line">
    <xsl:choose>
      <xsl:when test="@type = 'line'">
        <hr class="lb-rule" />
      </xsl:when>
      <xsl:when test="@type = 'empty'">
        <br class="lb-line" data-type="empty" />
        <br class="lb-line lb-line--empty" data-type="empty" />
      </xsl:when>
      <xsl:otherwise>
        <br class="lb-line">
          <xsl:attribute name="data-type" select="if (@type) then string(@type) else 'break'" />
        </br>
        <xsl:if test="@tab">
          <span class="lb-indent" data-tab="{@tab}"></span>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="tei:align">
    <div class="align" data-pos="{@pos}">
      <xsl:apply-templates />
    </div>
  </xsl:template>

  <xsl:template match="tei:aq">
    <span class="aq"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:ul">
    <span class="ul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:tul">
    <span class="tul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:dul">
    <span class="dul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:highlight">
    <mark class="highlight" data-color="{@color}" style="background-color: {@color};">
      <xsl:apply-templates />
    </mark>
  </xsl:template>

  <xsl:template match="tei:undo">
    <span class="undo"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:address">
    <address><xsl:apply-templates /></address>
  </xsl:template>

  <xsl:template match="tei:insertion">
    <span class="insertion">
      <xsl:if test="@pos">
        <xsl:attribute name="data-pos" select="@pos" />
      </xsl:if>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="tei:del">
    <del><xsl:apply-templates /></del>
  </xsl:template>

  <xsl:template match="tei:hand">
    <span class="hand" data-ref="{@ref}"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:note">
    <span class="note"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:tl">
    <span class="tl"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:fn">
    <span class="fn" data-index="{@index}"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:pe">
    <span class="pe"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:anchor">
    <span class="anchor"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:nr">
    <span class="nr">
      <xsl:if test="@extent">
        <xsl:attribute name="data-extent" select="@extent" />
      </xsl:if>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="tei:b">
    <strong><xsl:apply-templates /></strong>
  </xsl:template>

  <xsl:template match="tei:it">
    <em><xsl:apply-templates /></em>
  </xsl:template>

  <xsl:template match="tei:gr">
    <span class="gr"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:hb">
    <span class="hb"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:er">
    <span class="er"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:ink">
    <span class="ink"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:large">
    <span class="large"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:ru">
    <span class="ru"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:subst">
    <span class="subst"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="tei:tabs">
    <div class="tabs"><xsl:apply-templates /></div>
  </xsl:template>

  <xsl:template match="tei:tab">
    <div class="tab" data-value="{@value}"><xsl:apply-templates /></div>
  </xsl:template>

</xsl:stylesheet>
