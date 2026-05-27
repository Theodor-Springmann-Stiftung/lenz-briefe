<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="lb xs">

  <xsl:output method="html" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:mode on-no-match="shallow-skip" />

  <xsl:template match="text()">
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="lb:page">
    <span class="page-anchor" id="{concat('page-', @index)}">&#x200C;</span>
    <span class="lb-page" data-index="{@index}"></span>
  </xsl:template>

  <xsl:template match="lb:sidenote">
    <span class="sidenote-marker">
      <xsl:attribute name="id" select="
        concat(
          'anchor-letter-',
          format-integer(xs:integer(/*/@letter), '000'),
          '-page-',
          string(@page),
          '-sidenote-',
          string(count(preceding::lb:sidenote[@page = current()/@page]) + 1)
        )
      " />
    </span>
  </xsl:template>

  <xsl:template match="lb:line">
    <xsl:choose>
      <xsl:when test="@type = 'line'">
        <hr class="lb-rule" />
      </xsl:when>
      <xsl:when test="@type = 'empty'">
        <br class="lb-line" data-type="empty" />
        <br class="lb-line lb-line--empty" data-type="empty" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:if test="not(preceding-sibling::*[1][self::lb:align]) and not(following-sibling::*[1][self::lb:align])">
          <br class="lb-line">
            <xsl:attribute name="data-type" select="if (@type) then string(@type) else 'break'" />
          </br>
        </xsl:if>
        <xsl:if test="@tab and not(following-sibling::*[1][self::lb:align])">
          <span class="lb-indent" data-tab="{@tab}"></span>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="lb:align">
    <span class="align" data-pos="{@pos}">
      <xsl:if test="preceding-sibling::*[1][self::lb:line[@tab]]">
        <xsl:attribute name="data-tab" select="string(preceding-sibling::*[1]/@tab)" />
      </xsl:if>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="lb:added">
    <span class="added"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:aq">
    <span class="aq"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ul">
    <span class="ul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:tul">
    <span class="tul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:dul">
    <span class="dul"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:highlight">
    <mark class="highlight" data-color="{@color}" style="background-color: {@color};">
      <xsl:apply-templates />
    </mark>
  </xsl:template>

  <xsl:template match="lb:undo">
    <span class="undo"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:address">
    <address><xsl:apply-templates /></address>
  </xsl:template>

  <xsl:template match="lb:insertion">
    <span class="insertion">
      <xsl:if test="@pos">
        <xsl:attribute name="data-pos" select="@pos" />
      </xsl:if>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="lb:del">
    <del><xsl:apply-templates /></del>
  </xsl:template>

  <xsl:template match="lb:hand">
    <span class="hand" data-ref="{@ref}"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:note">
    <span class="note"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:tl">
    <span class="tl"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:fn">
    <span class="fn" data-index="{@index}"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:pe">
    <span class="pe"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:anchor">
    <span class="anchor"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:nr">
    <span class="nr">
      <xsl:if test="@extent">
        <xsl:attribute name="data-extent" select="@extent" />
      </xsl:if>
      <xsl:apply-templates />
    </span>
  </xsl:template>

  <xsl:template match="lb:b">
    <strong><xsl:apply-templates /></strong>
  </xsl:template>

  <xsl:template match="lb:it">
    <em><xsl:apply-templates /></em>
  </xsl:template>

  <xsl:template match="lb:gr">
    <span class="gr"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:hb">
    <span class="hb"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:sub">
    <sub class="sub"><xsl:apply-templates /></sub>
  </xsl:template>

  <xsl:template match="lb:super">
    <sup class="super"><xsl:apply-templates /></sup>
  </xsl:template>

  <xsl:template match="lb:er">
    <span class="er"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ink">
    <span class="ink"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:large">
    <span class="large"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ru">
    <span class="ru"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:subst">
    <span class="subst"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ful">
    <span class="ful"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:datum">
    <span class="datum"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:ps">
    <span class="ps"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:sal">
    <span class="sal"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:sig">
    <span class="sig"><xsl:apply-templates /></span>
  </xsl:template>

  <xsl:template match="lb:tabs">
    <div class="tabs"><xsl:apply-templates /></div>
  </xsl:template>

  <xsl:template match="lb:tab">
    <div class="tab" data-value="{@value}"><xsl:apply-templates /></div>
  </xsl:template>

</xsl:stylesheet>
