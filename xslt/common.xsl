<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:lb="https://lenz-archiv.de"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:t="urn:lenz-temp"
  exclude-result-prefixes="lb xs t">

  <xsl:output method="html" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:mode on-no-match="shallow-skip" />

  <xsl:template name="lb:render-flow">
    <xsl:param name="nodes" as="node()*" />
    <xsl:apply-templates select="lb:normalize-flow($nodes)" />
  </xsl:template>

  <xsl:function name="lb:has-meaningful-content" as="xs:boolean">
    <xsl:param name="nodes" as="node()*" />
    <xsl:sequence select="
      exists(
        $nodes[
          self::text()[normalize-space()]
          or self::*[not(self::t:page or self::t:sidenote-marker)]
        ]
      )
    " />
  </xsl:function>

  <xsl:function name="lb:has-inline-markers" as="xs:boolean">
    <xsl:param name="nodes" as="node()*" />
    <xsl:sequence select="exists($nodes[self::t:page or self::t:sidenote-marker])" />
  </xsl:function>

  <xsl:function name="lb:temp-line" as="element(t:line)">
    <xsl:param name="nodes" as="node()*" />
    <t:line>
      <xsl:sequence select="$nodes" />
    </t:line>
  </xsl:function>

  <xsl:function name="lb:temp-explicit-line" as="element(t:line)">
    <xsl:param name="type" as="xs:string?" />
    <xsl:param name="tab" as="xs:string?" />
    <xsl:param name="nodes" as="node()*" />
    <t:line>
      <xsl:if test="exists($type)">
        <xsl:attribute name="type" select="$type" />
      </xsl:if>
      <xsl:if test="exists($tab)">
        <xsl:attribute name="tab" select="$tab" />
      </xsl:if>
      <xsl:sequence select="$nodes" />
    </t:line>
  </xsl:function>

  <xsl:function name="lb:temp-page" as="element(t:page)">
    <xsl:param name="index" as="xs:string" />
    <t:page index="{$index}" />
  </xsl:function>

  <xsl:function name="lb:temp-sidenote-marker" as="element(t:sidenote-marker)">
    <xsl:param name="node" as="element(lb:sidenote)" />
    <t:sidenote-marker
      id="{
        concat(
          'anchor-letter-',
          format-integer(xs:integer(root($node)/*/@letter), '000'),
          '-page-',
          string($node/@page),
          '-sidenote-',
          string(count($node/preceding::lb:sidenote[@page = $node/@page]) + 1)
        )
      }"
    />
  </xsl:function>

  <xsl:function name="lb:clone-element" as="element()">
    <xsl:param name="element" as="element()" />
    <xsl:param name="children" as="node()*" />
    <xsl:element name="{local-name($element)}" namespace="{namespace-uri($element)}">
      <xsl:copy-of select="$element/@*" />
      <xsl:sequence select="$children" />
    </xsl:element>
  </xsl:function>

  <xsl:function name="lb:flush-state" as="map(*)">
    <xsl:param name="completed" as="element()*" />
    <xsl:param name="current-type" as="xs:string?" />
    <xsl:param name="current-tab" as="xs:string?" />
    <xsl:param name="current-content" as="node()*" />
    <xsl:variable name="next-completed" as="element()*" select="
      if (lb:has-meaningful-content($current-content))
      then (
        $completed,
        if (exists($current-type) or exists($current-tab))
        then lb:temp-explicit-line($current-type, $current-tab, $current-content)
        else lb:temp-line($current-content)
      )
      else $completed
    " />
    <xsl:sequence select="map {
      'completed': $next-completed,
      'currentType': (),
      'currentTab': (),
      'currentContent': if (lb:has-meaningful-content($current-content)) then () else $current-content
    }" />
  </xsl:function>

  <xsl:function name="lb:materialize-marker-state" as="map(*)">
    <xsl:param name="completed" as="element()*" />
    <xsl:param name="current-type" as="xs:string?" />
    <xsl:param name="current-tab" as="xs:string?" />
    <xsl:param name="current-content" as="node()*" />
    <xsl:sequence select="
      if (lb:has-inline-markers($current-content) and not(lb:has-meaningful-content($current-content)))
      then map {
        'completed': ($completed, $current-content[self::t:page or self::t:sidenote-marker]),
        'currentType': $current-type,
        'currentTab': $current-tab,
        'currentContent': ()
      }
      else map {
        'completed': $completed,
        'currentType': $current-type,
        'currentTab': $current-tab,
        'currentContent': $current-content
      }
    " />
  </xsl:function>

  <xsl:function name="lb:merge-lines-into-state" as="map(*)">
    <xsl:param name="completed" as="element()*" />
    <xsl:param name="current-type" as="xs:string?" />
    <xsl:param name="current-tab" as="xs:string?" />
    <xsl:param name="current-content" as="node()*" />
    <xsl:param name="incoming-lines" as="element(t:line)*" />
    <xsl:iterate select="$incoming-lines">
      <xsl:param name="completed" as="element()*" select="$completed" />
      <xsl:param name="current-type" as="xs:string?" select="$current-type" />
      <xsl:param name="current-tab" as="xs:string?" select="$current-tab" />
      <xsl:param name="current-content" as="node()*" select="$current-content" />
      <xsl:on-completion select="map {
        'completed': $completed,
        'currentType': $current-type,
        'currentTab': $current-tab,
        'currentContent': $current-content
      }" />
      <xsl:variable name="line-type" as="xs:string?" select="if (@type) then string(@type) else ()" />
      <xsl:variable name="line-tab" as="xs:string?" select="if (@tab) then string(@tab) else ()" />
      <xsl:choose>
        <xsl:when test="empty(@type) and empty(@tab)">
          <xsl:next-iteration>
            <xsl:with-param name="completed" select="$completed" />
            <xsl:with-param name="current-type" select="$current-type" />
            <xsl:with-param name="current-tab" select="$current-tab" />
            <xsl:with-param name="current-content" select="($current-content, node())" />
          </xsl:next-iteration>
        </xsl:when>
        <xsl:when test="$line-type = ('empty', 'line')">
          <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
          <xsl:next-iteration>
            <xsl:with-param name="completed" select="($flushed?completed, lb:temp-explicit-line($line-type, $line-tab, node()))" />
            <xsl:with-param name="current-type" select="()" />
            <xsl:with-param name="current-tab" select="()" />
            <xsl:with-param name="current-content" select="()" />
          </xsl:next-iteration>
        </xsl:when>
        <xsl:otherwise>
          <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
          <xsl:next-iteration>
            <xsl:with-param name="completed" select="$flushed?completed" />
            <xsl:with-param name="current-type" select="$line-type" />
            <xsl:with-param name="current-tab" select="$line-tab" />
            <xsl:with-param name="current-content" select="node()" />
          </xsl:next-iteration>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:iterate>
  </xsl:function>

  <xsl:function name="lb:wrap-element-across-lines" as="element(t:line)*">
    <xsl:param name="element" as="element()" />
    <xsl:param name="lines" as="element(t:line)*" />
    <xsl:choose>
      <xsl:when test="empty($lines)">
        <xsl:sequence select="lb:temp-line(lb:clone-element($element, ()))" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:sequence select="
          for $line in $lines
          return
            if ($line/@type = ('empty', 'line') and not(lb:has-meaningful-content($line/node())))
            then lb:temp-explicit-line(string($line/@type), if ($line/@tab) then string($line/@tab) else (), ())
            else if (exists($line/@type) or exists($line/@tab))
            then lb:temp-explicit-line(
              if ($line/@type) then string($line/@type) else (),
              if ($line/@tab) then string($line/@tab) else (),
              lb:clone-element($element, $line/node())
            )
            else lb:temp-line(lb:clone-element($element, $line/node()))
        " />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="lb:normalize-tabs" as="element(t:tabs)">
    <xsl:param name="element" as="element(lb:tabs)" />
    <t:tabs>
      <xsl:if test="$element/@extent">
        <xsl:attribute name="extent" select="string($element/@extent)" />
      </xsl:if>
      <xsl:for-each select="lb:normalize-lines($element/node())">
        <t:row>
          <xsl:if test="@type">
            <xsl:attribute name="type" select="string(@type)" />
          </xsl:if>
          <xsl:if test="@tab">
            <xsl:attribute name="tab" select="string(@tab)" />
          </xsl:if>
          <xsl:sequence select="node()" />
        </t:row>
      </xsl:for-each>
    </t:tabs>
  </xsl:function>

  <xsl:function name="lb:normalize-node-to-lines" as="element(t:line)*">
    <xsl:param name="node" as="node()" />
    <xsl:choose>
      <xsl:when test="$node/self::text()">
        <xsl:sequence select="lb:temp-line($node)" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:page)">
        <xsl:sequence select="lb:temp-line(lb:temp-page(string($node/@index)))" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:sidenote)">
        <xsl:sequence select="lb:temp-line(lb:temp-sidenote-marker($node))" />
      </xsl:when>
      <xsl:when test="$node/self::element(lb:tabs)">
        <xsl:sequence select="lb:temp-line(lb:normalize-tabs($node))" />
      </xsl:when>
      <xsl:when test="$node/self::element()">
        <xsl:sequence select="lb:wrap-element-across-lines($node, lb:normalize-lines($node/node()))" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:sequence select="lb:temp-line($node)" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="lb:normalize-lines" as="element(t:line)*">
    <xsl:param name="nodes" as="node()*" />
    <xsl:variable name="state" as="map(*)">
      <xsl:iterate select="$nodes">
        <xsl:param name="completed" as="element(t:line)*" select="()" />
        <xsl:param name="current-type" as="xs:string?" select="()" />
        <xsl:param name="current-tab" as="xs:string?" select="()" />
        <xsl:param name="current-content" as="node()*" select="()" />
        <xsl:on-completion select="lb:materialize-marker-state(lb:flush-state($completed, $current-type, $current-tab, $current-content)?completed, (), (), lb:flush-state($completed, $current-type, $current-tab, $current-content)?currentContent)" />
        <xsl:choose>
          <xsl:when test="self::element(lb:line)">
            <xsl:variable name="line-type" as="xs:string" select="if (@type) then string(@type) else 'break'" />
            <xsl:variable name="line-tab" as="xs:string?" select="if (@tab) then string(@tab) else ()" />
            <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
            <xsl:choose>
              <xsl:when test="$line-type = ('empty', 'line')">
                <xsl:variable name="materialized" select="lb:materialize-marker-state($flushed?completed, (), (), $flushed?currentContent)" />
                <xsl:next-iteration>
                  <xsl:with-param name="completed" select="($materialized?completed, lb:temp-explicit-line($line-type, $line-tab, ()))" />
                  <xsl:with-param name="current-type" select="()" />
                  <xsl:with-param name="current-tab" select="()" />
                  <xsl:with-param name="current-content" select="()" />
                </xsl:next-iteration>
              </xsl:when>
              <xsl:otherwise>
                <xsl:next-iteration>
                  <xsl:with-param name="completed" select="$flushed?completed" />
                  <xsl:with-param name="current-type" select="$line-type" />
                  <xsl:with-param name="current-tab" select="$line-tab" />
                  <xsl:with-param name="current-content" select="$flushed?currentContent" />
                </xsl:next-iteration>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:when>
          <xsl:otherwise>
            <xsl:variable name="merged" select="lb:merge-lines-into-state($completed, $current-type, $current-tab, $current-content, lb:normalize-node-to-lines(.))" />
            <xsl:next-iteration>
              <xsl:with-param name="completed" select="$merged?completed" />
              <xsl:with-param name="current-type" select="$merged?currentType" />
              <xsl:with-param name="current-tab" select="$merged?currentTab" />
              <xsl:with-param name="current-content" select="$merged?currentContent" />
            </xsl:next-iteration>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:iterate>
    </xsl:variable>
    <xsl:sequence select="$state?completed" />
  </xsl:function>

  <xsl:function name="lb:normalize-flow" as="element()*">
    <xsl:param name="nodes" as="node()*" />
    <xsl:variable name="state" as="map(*)">
      <xsl:iterate select="$nodes">
        <xsl:param name="completed" as="element()*" select="()" />
        <xsl:param name="current-type" as="xs:string?" select="()" />
        <xsl:param name="current-tab" as="xs:string?" select="()" />
        <xsl:param name="current-content" as="node()*" select="()" />
        <xsl:on-completion select="lb:materialize-marker-state(lb:flush-state($completed, $current-type, $current-tab, $current-content)?completed, (), (), lb:flush-state($completed, $current-type, $current-tab, $current-content)?currentContent)" />
        <xsl:choose>
          <xsl:when test="self::element(lb:line)">
            <xsl:variable name="line-type" as="xs:string" select="if (@type) then string(@type) else 'break'" />
            <xsl:variable name="line-tab" as="xs:string?" select="if (@tab) then string(@tab) else ()" />
            <xsl:variable name="flushed" select="lb:flush-state($completed, $current-type, $current-tab, $current-content)" />
            <xsl:choose>
              <xsl:when test="$line-type = ('empty', 'line')">
                <xsl:variable name="materialized" select="lb:materialize-marker-state($flushed?completed, (), (), $flushed?currentContent)" />
                <xsl:next-iteration>
                  <xsl:with-param name="completed" select="($materialized?completed, lb:temp-explicit-line($line-type, $line-tab, ()))" />
                  <xsl:with-param name="current-type" select="()" />
                  <xsl:with-param name="current-tab" select="()" />
                  <xsl:with-param name="current-content" select="()" />
                </xsl:next-iteration>
              </xsl:when>
              <xsl:otherwise>
                <xsl:next-iteration>
                  <xsl:with-param name="completed" select="$flushed?completed" />
                  <xsl:with-param name="current-type" select="$line-type" />
                  <xsl:with-param name="current-tab" select="$line-tab" />
                  <xsl:with-param name="current-content" select="$flushed?currentContent" />
                </xsl:next-iteration>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:when>
          <xsl:otherwise>
            <xsl:variable name="merged" select="lb:merge-lines-into-state($completed, $current-type, $current-tab, $current-content, lb:normalize-node-to-lines(.))" />
            <xsl:next-iteration>
              <xsl:with-param name="completed" select="$merged?completed" />
              <xsl:with-param name="current-type" select="$merged?currentType" />
              <xsl:with-param name="current-tab" select="$merged?currentTab" />
              <xsl:with-param name="current-content" select="$merged?currentContent" />
            </xsl:next-iteration>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:iterate>
    </xsl:variable>
    <xsl:sequence select="$state?completed" />
  </xsl:function>

  <xsl:template match="text()">
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="t:page | lb:page">
    <xsl:variable
      name="is-inline-break"
      as="xs:boolean"
      select="lb:has-meaningful-content(preceding-sibling::node()) and lb:has-meaningful-content(following-sibling::node())"
    />
    <span class="page-anchor" id="{concat('page-', @index)}">
      <xsl:if test="$is-inline-break">
        <xsl:attribute name="data-inline-break">true</xsl:attribute>
      </xsl:if>
      <xsl:value-of select="if ($is-inline-break) then ' | ' else '&#x200C;'" />
    </span>
    <span class="lb-page" data-index="{@index}"></span>
  </xsl:template>

  <xsl:template match="t:sidenote-marker">
    <span class="sidenote-marker" id="{@id}"></span>
  </xsl:template>

  <xsl:template match="t:line">
    <xsl:variable name="line-type" as="xs:string" select="if (@type) then string(@type) else 'break'" />
    <xsl:variable
      name="meaningful-content"
      as="node()*"
      select="node()[not(self::text()[not(normalize-space())]) and not(self::t:sidenote-marker or self::t:page)]"
    />
    <xsl:variable name="is-promoted-align" as="xs:boolean" select="count($meaningful-content) = 1 and $meaningful-content[1][self::lb:align]" />
    <div>
      <xsl:attribute name="class" select="
        string-join(
          (
            'lb-line-block',
            if ($line-type = 'empty') then 'lb-line-block--empty' else (),
            if ($line-type = 'line') then 'lb-line-block--rule' else ()
          ),
          ' '
        )
      " />
      <xsl:attribute name="data-type" select="$line-type" />
      <xsl:if test="@tab">
        <xsl:attribute name="data-tab" select="string(@tab)" />
      </xsl:if>
      <xsl:if test="$is-promoted-align">
        <xsl:attribute name="data-align" select="string($meaningful-content[1]/@pos)" />
      </xsl:if>
      <xsl:choose>
        <xsl:when test="$line-type = 'line'">
          <hr class="lb-rule" />
        </xsl:when>
        <xsl:when test="$is-promoted-align">
          <xsl:for-each select="node()">
            <xsl:choose>
              <xsl:when test="self::lb:align">
                <xsl:apply-templates select="node()" />
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="." />
              </xsl:otherwise>
            </xsl:choose>
          </xsl:for-each>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="node()" />
        </xsl:otherwise>
      </xsl:choose>
    </div>
  </xsl:template>

  <xsl:template match="t:tabs">
    <div class="tabs">
      <xsl:if test="@extent">
        <xsl:attribute name="data-extent" select="string(@extent)" />
      </xsl:if>
      <xsl:apply-templates />
    </div>
  </xsl:template>

  <xsl:template match="t:row">
    <div class="lb-tab-row">
      <xsl:attribute name="data-type" select="if (@type) then string(@type) else 'break'" />
      <xsl:if test="@tab">
        <xsl:attribute name="data-tab" select="string(@tab)" />
      </xsl:if>
      <xsl:choose>
        <xsl:when test="@type = 'line'">
          <hr class="lb-rule" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="node()" />
        </xsl:otherwise>
      </xsl:choose>
    </div>
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
    <xsl:sequence />
  </xsl:template>

  <xsl:template match="lb:align">
    <span class="align" data-pos="{@pos}">
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
    <xsl:apply-templates select="lb:normalize-tabs(.)" />
  </xsl:template>

  <xsl:template match="lb:tab">
    <div class="tab" data-value="{@value}"><xsl:apply-templates /></div>
  </xsl:template>

</xsl:stylesheet>
